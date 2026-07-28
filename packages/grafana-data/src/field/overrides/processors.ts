import { type Action } from '../../types/action';
import { type Field } from '../../types/dataFrame';
import { type DataLink } from '../../types/dataLink';
import { type FieldOverrideContext } from '../../types/fieldOverrides';
import { type SelectableValue } from '../../types/select';
import { type SliderMarks } from '../../types/slider';
import { type Threshold, type ThresholdsConfig } from '../../types/thresholds';
import { type ValueMapping } from '../../types/valueMapping';
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

export interface ValueMappingFieldConfigSettings {}

export const valueMappingsOverrideProcessor = (
  value: any,
  _context: FieldOverrideContext,
  _settings?: ValueMappingFieldConfigSettings
): ValueMapping[] => {
  return value; // !!!! likely not !!!!
};

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

export interface ThresholdsFieldConfigSettings {
  // Anything?
}

/**
 * Resolves a threshold step's optional `valueExpr` (a dashboard-variable expression)
 * against the current variable values. Falls back to the numeric `value` when the
 * expression is missing, resolves to something non-numeric, or the variable currently
 * has more than one value selected. The returned step never carries `valueExpr`.
 */
function resolveThreshold(step: Threshold, context: FieldOverrideContext): Threshold {
  const { valueExpr, ...resolved } = step;

  if (!valueExpr || !context.replaceVariables) {
    return resolved;
  }

  // The function format exposes raw variable values at interpolation time:
  // multi-value selections arrive as arrays and are only valid with exactly one value selected
  let multiInvalid = false;
  const text = context.replaceVariables(valueExpr, context.field?.state?.scopedVars, (v: unknown) => {
    if (Array.isArray(v)) {
      if (v.length > 1) {
        multiInvalid = true;
        return '';
      }
      return String(v[0]);
    }
    return String(v);
  });

  // Strict parsing: Number() rejects partial-numeric strings like '80ms';
  // unknown variables are left uninterpolated and fail parsing the same way
  const trimmed = text.trim();
  const num = trimmed === '' ? NaN : Number(trimmed);

  if (multiInvalid || !Number.isFinite(num)) {
    return resolved;
  }

  return { ...resolved, value: num };
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
