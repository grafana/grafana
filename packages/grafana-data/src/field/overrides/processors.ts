import { VariableFormatID } from '@grafana/schema';

import { type Action } from '../../types/action';
import { type Field } from '../../types/dataFrame';
import { type DataLink } from '../../types/dataLink';
import {
  FieldConfigProperty,
  type FieldConfigPropertyItem,
  type FieldOverrideContext,
} from '../../types/fieldOverrides';
import { type SelectableValue } from '../../types/select';
import { type SliderMarks } from '../../types/slider';
import { type Threshold, type ThresholdsConfig } from '../../types/thresholds';
import { MappingType, type ValueMapping, type ValueMappingResult } from '../../types/valueMapping';
import { sortThresholds } from '../thresholds';

export const identityOverrideProcessor = <T>(value: T) => {
  return value;
};

export interface NumberFieldConfigSettings {
  placeholder?: string;
  integer?: boolean;
  min?: number;
  max?: number;
  step?: number;
}

export const numberOverrideProcessor = (
  value: unknown,
  context: FieldOverrideContext,
  settings?: NumberFieldConfigSettings
) => {
  if (value === undefined || value === null) {
    return undefined;
  }

  return parseFloat(String(value));
};

export const displayNameOverrideProcessor = (
  value: unknown,
  context: FieldOverrideContext,
  settings?: StringFieldConfigSettings
) => {
  // clear the cached display name
  delete context.field?.state?.displayName;
  return stringOverrideProcessor(value, context, settings);
};

export interface SliderFieldConfigSettings {
  min: number;
  max: number;
  step?: number;
  included?: boolean;
  marks?: SliderMarks;
  ariaLabelForHandle?: string;
}

export interface DataLinksFieldConfigSettings {
  showOneClick?: boolean;
}

export const dataLinksOverrideProcessor = (
  value: any,
  _context: FieldOverrideContext,
  _settings?: DataLinksFieldConfigSettings
): DataLink[] => {
  return value;
};

export const actionsOverrideProcessor = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
  _context: FieldOverrideContext,
  _settings?: DataLinksFieldConfigSettings
): Action[] => {
  return value;
};

export interface ValueMappingFieldConfigSettings {
  /** Interpolates dashboard variables in the display texts */
  interpolateText?: boolean;
}

export const valueMappingsOverrideProcessor = (
  value: any,
  context: FieldOverrideContext,
  settings?: ValueMappingFieldConfigSettings
): ValueMapping[] => {
  const { replaceVariables } = context;
  if (!settings?.interpolateText || !replaceVariables || !Array.isArray(value) || !value.some(hasTextWithVariable)) {
    return value;
  }

  // A `$` that doesn't name a known variable, as in `$5 off`, is left as typed by the interpolation
  const interpolate = (result: ValueMappingResult): ValueMappingResult =>
    mayHaveVariable(result?.text)
      ? { ...result, text: replaceVariables(result.text, context.field?.state?.scopedVars, VariableFormatID.Text) }
      : result;

  return value.map((mapping: ValueMapping): ValueMapping => {
    switch (mapping.type) {
      case MappingType.ValueToText:
        return {
          ...mapping,
          options: Object.fromEntries(
            Object.entries(mapping.options).map(([key, result]) => [key, interpolate(result)])
          ),
        };
      case MappingType.RangeToText:
        return { ...mapping, options: { ...mapping.options, result: interpolate(mapping.options.result) } };
      case MappingType.RegexToText:
        return { ...mapping, options: { ...mapping.options, result: interpolate(mapping.options.result) } };
      case MappingType.SpecialValue:
        return { ...mapping, options: { ...mapping.options, result: interpolate(mapping.options.result) } };
      default:
        return mapping;
    }
  });
};

function hasTextWithVariable(mapping: ValueMapping): boolean {
  const results =
    mapping.type === MappingType.ValueToText ? Object.values(mapping.options ?? {}) : [mapping.options?.result];
  return results.some((result) => mayHaveVariable(result?.text));
}

/**
 * Whether a display text may reference a variable, as `$var`, `${var}` or `[[var]]`. Hand-edited
 * JSON can hold a text that isn't a string, which is left as is.
 */
function mayHaveVariable(text: unknown): text is string {
  return typeof text === 'string' && (text.includes('$') || text.includes('[['));
}

export interface SelectFieldConfigSettings<T> {
  allowCustomValue?: boolean;

  isClearable?: boolean;

  /** The default options */
  options: Array<SelectableValue<T>>;

  /** Optionally use the context to define the options */
  getOptions?: (context: FieldOverrideContext) => Promise<Array<SelectableValue<T>>>;
}

export const selectOverrideProcessor = (
  value: any,
  _context: FieldOverrideContext,
  _settings?: SelectFieldConfigSettings<any>
) => {
  return value;
};

export interface StringFieldConfigSettings {
  placeholder?: string;
  maxLength?: number;
  expandTemplateVars?: boolean;
  useTextarea?: boolean;
  rows?: number;
}

export const stringOverrideProcessor = (
  value: unknown,
  context: FieldOverrideContext,
  settings?: StringFieldConfigSettings
) => {
  if (value === null || value === undefined) {
    return value;
  }
  if (settings && settings.expandTemplateVars && context.replaceVariables && typeof value === 'string') {
    return context.replaceVariables(value, context.field!.state!.scopedVars);
  }
  return `${value}`;
};

/**
 * Interpolates a `varMappings` expression to trimmed text, or `undefined` when there is no
 * `replaceVariables` or a referenced variable doesn't have exactly one value selected.
 */
export function interpolateVarMapping(
  expr: string,
  context: Pick<FieldOverrideContext, 'replaceVariables' | 'field'>
): string | undefined {
  if (!context.replaceVariables) {
    return undefined;
  }

  // The function format exposes raw variable values at interpolation time: multi-value selections
  // arrive as arrays, and a value is only valid when exactly one is selected and it isn't null
  let invalid = false;
  const text = context
    .replaceVariables(expr, context.field?.state?.scopedVars, (v: unknown) => {
      const values = Array.isArray(v) ? v : [v];
      if (values.length !== 1 || values[0] == null) {
        invalid = true;
        return '';
      }
      return String(values[0]);
    })
    .trim();

  return invalid ? undefined : text;
}

/**
 * Resolves a `varMappings` expression (e.g. `$myVar`) to a number. Returns `undefined` when there
 * is no `replaceVariables`, the result isn't numeric or is outside the settings' `min`/`max`, or a
 * referenced variable doesn't have exactly one value selected, so callers can fall back to the stored value.
 */
export function resolveVarMapping(expr: string, context: FieldOverrideContext, settings?: unknown): number | undefined {
  const text = interpolateVarMapping(expr, context);
  return text === undefined ? undefined : toVarMappingNumber(text, settings);
}

/** The number for the text, kept to the settings' range and floored for integer settings */
function toVarMappingNumber(text: string, settings: unknown): number | undefined {
  // Strict parsing: Number() rejects partial-numeric strings like '80ms';
  // unknown variables are left uninterpolated and fail parsing the same way
  const num = text === '' ? NaN : Number(text);
  if (!Number.isFinite(num) || !isInVarMappingRange(num, settings)) {
    return undefined;
  }
  return getNumberSettings(settings).integer ? Math.floor(num) : num;
}

/**
 * Whether a number is within the `min`/`max` of number or slider settings. Out of range values
 * fall back, the same way an unresolved expression does.
 */
export function isInVarMappingRange(value: number, settings: unknown): boolean {
  const { min, max } = getNumberSettings(settings);
  return (typeof min !== 'number' || value >= min) && (typeof max !== 'number' || value <= max);
}

function getNumberSettings(settings: unknown): NumberFieldConfigSettings {
  return typeof settings === 'object' && settings !== null ? settings : {};
}

// Same template syntax the variable interpolators recognize: $var, [[var]] and ${var...}
const VARIABLE_REFERENCE = /\$\w+|\[\[\w+?(?::\w+)?\]\]|\$\{\w+(?:\.[^:^}]+)?(?::[^}]+)?\}/;

/**
 * Resolves a `varMappings` expression to a non-empty string, or `undefined` for the same failures
 * as `resolveVarMapping`.
 *
 * Interpolators leave an unknown variable in the text unchanged, so a result that still contains
 * variable syntax also counts as unresolved; otherwise `$foo` would render as a unit suffix. A `$`
 * that isn't variable syntax, as in the custom units `prefix:$` or `suffix:$`, is kept.
 */
export function resolveVarMappingString(expr: string, context: FieldOverrideContext): string | undefined {
  const text = interpolateVarMapping(expr, context);

  return text && !VARIABLE_REFERENCE.test(text) ? text : undefined;
}

/**
 * Whether text holds variable syntax, as opposed to a lone or literal `$`. Interpolators leave an
 * unknown variable in the text, so after interpolation this also means a variable wasn't found.
 */
export function hasVarMappingVariableReference(text: string): boolean {
  return VARIABLE_REFERENCE.test(text);
}

/**
 * Resolves a `varMappings` expression to one of a select's option values, matched against the
 * option value text case-insensitively. Returns the option's typed value (e.g. `-1` or `true`), or
 * `undefined` for the same failures as `resolveVarMapping` or when no option matches. Options
 * without a value, like "Auto", can't be matched.
 */
export function resolveVarMappingOption(
  expr: string,
  context: FieldOverrideContext,
  options: Array<SelectableValue<unknown>>
): unknown {
  const text = interpolateVarMapping(expr, context);
  return text === undefined ? undefined : matchVarMappingOption(text, options);
}

function matchVarMappingOption(text: string, options: Array<SelectableValue<unknown>>): unknown {
  const lower = text.toLowerCase();
  if (!lower) {
    return undefined;
  }

  return options.find((option) => option.value !== undefined && String(option.value).toLowerCase() === lower)?.value;
}

const BOOLEAN_TEXT = new Map([
  ['true', true],
  ['1', true],
  ['on', true],
  ['yes', true],
  ['false', false],
  ['0', false],
  ['off', false],
  ['no', false],
]);

/**
 * Resolves a `varMappings` expression to a boolean from common true/false spellings, or `undefined`
 * for anything else and the same failures as `resolveVarMapping`.
 */
export function resolveVarMappingBoolean(expr: string, context: FieldOverrideContext): boolean | undefined {
  const text = interpolateVarMapping(expr, context);

  return text ? BOOLEAN_TEXT.get(text.toLowerCase()) : undefined;
}

export type VarMappingKind = 'number' | 'string' | 'option' | 'boolean';

/**
 * Resolves already interpolated text the way the number, option and boolean resolvers do, so an
 * editor can check a variable's values against the same rules the panel renders with. `settings`
 * are the property's settings, which hold a select's options and a number's range.
 */
export function resolveVarMappingText(
  kind: Exclude<VarMappingKind, 'string'>,
  text: string,
  settings?: unknown
): unknown {
  switch (kind) {
    case 'number':
      return toVarMappingNumber(text, settings);
    case 'option':
      return matchVarMappingOption(text.trim(), getVarMappingOptions(settings));
    case 'boolean':
      return BOOLEAN_TEXT.get(text.trim().toLowerCase());
  }
}

/**
 * How a property's `varMappings` expression resolves, or `undefined` when it can't have one.
 * Numeric properties resolve to a number. Only the standard unit resolves to a string; other string
 * properties either interpolate already (displayName) or would render unresolved syntax. Selects
 * and radios resolve to one of their options, so they need a static option list to check against.
 * Shared by the `applyFieldOverrides` resolution and the editors so both agree on the same set.
 */
export function getVarMappingKind(
  item: Pick<FieldConfigPropertyItem, 'id' | 'process' | 'settings'>
): VarMappingKind | undefined {
  if (item.process === numberOverrideProcessor) {
    return 'number';
  }
  if (item.id === FieldConfigProperty.Unit) {
    return 'string';
  }
  if (item.process === selectOverrideProcessor && getVarMappingOptions(item.settings).length > 0) {
    return 'option';
  }
  if (item.process === booleanOverrideProcessor) {
    return 'boolean';
  }
  return undefined;
}

/** The synchronous options of a select property; async `getOptions` results can't be checked against */
export function getVarMappingOptions(settings: unknown): Array<SelectableValue<unknown>> {
  const options = typeof settings === 'object' && settings !== null && 'options' in settings ? settings.options : [];
  return Array.isArray(options) ? options : [];
}

/**
 * Whether an editor value for a property of this kind is an expression to store in `varMappings`
 * rather than a plain value. Number editors only emit strings for expressions, and switches only
 * emit booleans. A unit or an option value is a plain string, so it needs variable syntax; a custom
 * unit like `prefix:$` stays a plain unit.
 */
export function isVarMappingExpressionInput(kind: VarMappingKind, value: unknown): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  return kind === 'number' || kind === 'boolean' || VARIABLE_REFERENCE.test(value);
}

export interface ThresholdsFieldConfigSettings {
  // Anything?
}

/**
 * Resolves a threshold step's optional `valueExpr` (a dashboard-variable expression)
 * against the current variable values. Falls back to the numeric `value` when the
 * expression is missing, resolves to something non-numeric, or the variable currently
 * doesn't have exactly one value selected. The returned step never carries `valueExpr`.
 */
function resolveThreshold(step: Threshold, context: FieldOverrideContext): Threshold {
  const { valueExpr, ...resolved } = step;
  const value = valueExpr ? resolveVarMapping(valueExpr, context) : undefined;

  return value === undefined ? resolved : { ...resolved, value };
}

export const thresholdsOverrideProcessor = (
  value: any,
  context: FieldOverrideContext,
  _settings?: ThresholdsFieldConfigSettings
): ThresholdsConfig => {
  if (!value || !Array.isArray(value.steps) || !value.steps.some((step: Threshold) => step.valueExpr != null)) {
    return value;
  }

  // The base step is always -Infinity (null in JSON); an expression there is meaningless and ignored
  const [{ valueExpr: baseExpr, ...base }, ...rawRest] = value.steps;
  const rest: Threshold[] = rawRest.map((step: Threshold) => resolveThreshold(step, context));

  // Edit-time sorting cannot know variable values, so re-sort the resolved copy,
  // keeping the base step first
  sortThresholds(rest);

  return { ...value, steps: [base, ...rest] };
};

export interface UnitFieldConfigSettings {
  isClearable?: boolean;
}

export const unitOverrideProcessor = (
  value: boolean,
  _context: FieldOverrideContext,
  _settings?: UnitFieldConfigSettings
) => {
  return value;
};

export const booleanOverrideProcessor = (
  value: boolean,
  _context: FieldOverrideContext,
  _settings?: ThresholdsFieldConfigSettings
) => {
  return value; // !!!! likely not !!!!
};

export interface FieldColorConfigSettings {
  /**
   * When switching to a visualization that does not support by value coloring then Grafana will
   * switch to a by series palette based color mode
   */
  byValueSupport?: boolean;
  /**
   * When switching to a visualization that has this set to true then Grafana will change color mode
   * to from thresholds if it was set to a by series palette
   */
  preferThresholdsMode?: boolean;
  /**
   * Set to true if the visualization supports both by value and by series
   * This will enable the Color by series UI option that sets the `color.seriesBy` option.
   */
  bySeriesSupport?: boolean;
  /**
   * Set to true if the visualization supports the Gradient color scheme.
   * When false (default), the Gradient option is hidden from the color picker.
   * Currently only the pie chart panel supports this mode.
   */
  gradientSupport?: boolean;
}

export interface StatsPickerConfigSettings {
  /**
   * Enable multi-selection in the stats picker
   */
  allowMultiple: boolean;
  /**
   * Default stats to be use in the stats picker
   */
  defaultStat?: string;
}

export enum FieldNamePickerBaseNameMode {
  IncludeAll = 'all',
  ExcludeBaseNames = 'exclude',
  OnlyBaseNames = 'only',
}

export interface FieldNamePickerConfigSettings {
  /**
   * Function is a predicate, to test each element of the array.
   * Return a value that coerces to true to keep the field, or to false otherwise.
   */
  filter?: (field: Field) => boolean;

  /**
   * Show this text when no values are found
   */
  noFieldsMessage?: string;

  /**
   * Sets the width to a pixel value.
   */
  width?: number;

  /**
   * Exclude names that can match a collection of values
   */
  baseNameMode?: FieldNamePickerBaseNameMode;

  /**
   * Placeholder text to display when nothing is selected.
   */
  placeholderText?: string;

  /** When set to false, the value can not be removed */
  isClearable?: boolean;
}
