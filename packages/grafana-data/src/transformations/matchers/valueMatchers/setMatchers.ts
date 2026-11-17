import { TableCellDisplayMode } from '@grafana/schema';

import { getDisplayProcessor } from '../../../field/displayProcessor';
import { createTheme } from '../../../themes/createTheme';
import { type Field, type FieldConfig } from '../../../types/dataFrame';
import { type ValueMatcherInfo } from '../../../types/transformations';
import { formattedValueToString } from '../../../valueFormats/baseFormatters';
import { ValueMatcherID } from '../ids';
import { getPillElements } from '../pillElements';

export interface ValueSetOptions {
  values: unknown[];
  mode?: 'raw' | 'display';
  displayConfig?: FieldConfig;
  timeZone?: string;
  /** When specified, match null/undefined independently of formatted values. */
  includeMissing?: boolean;
  /**
   * When true, multi-valued cells match when any element is in the set: array
   * values are matched element-wise, and pill-formatted strings per rendered
   * pill. Scalar values behave exactly as before.
   */
  matchElements?: boolean;
}

/** True when the field renders as pill cells, whose text holds multiple values. */
export function isPillCellField(field: Field): boolean {
  return field.config?.custom?.cellOptions?.type === TableCellDisplayMode.Pill;
}

/**
 * Split a cell value into matchable elements. Uses the shared pill inference
 * so filter options and matching agree with the rendered pills. Unlike
 * inferPills, empty strings yield [''] so blank cells keep flowing through the
 * existing blanks handling, and non-string scalars stay raw so raw-mode
 * matching still sees the original value.
 */
export function splitFilterElements(value: unknown): unknown[] {
  if (value === '') {
    return [''];
  }
  if (typeof value !== 'string' && !Array.isArray(value)) {
    return [value];
  }
  return getPillElements(value);
}

/**
 * Candidates a row value contributes to set matching. Arrays and pill-cell
 * values expand to their elements; anything else (including empty expansions,
 * which fall back to the whole value) behaves exactly as before.
 */
export function getValueSetCandidates(field: Field, value: unknown): unknown[] {
  if (Array.isArray(value) || isPillCellField(field)) {
    const elements = splitFilterElements(value);
    if (elements.length > 0) {
      return elements;
    }
  }
  return [value];
}

const fallbackTheme = createTheme();

export const valueSetMatcher: ValueMatcherInfo<ValueSetOptions> = {
  id: ValueMatcherID.inSet,
  name: 'Is in set',
  description: 'Matches a set of raw or formatted values.',
  // The transformation editor does not yet provide controls for this matcher.
  isApplicable: () => false,
  getDefaultOptions: () => ({ values: [] }),
  get: (options) => {
    const selected = new Set(options.values);
    const displays = new WeakMap<Field, ReturnType<typeof getDisplayProcessor>>();
    const matchElements = options.matchElements === true;
    return (index, field) => {
      const value = field.values[index];
      if (options.includeMissing !== undefined && value == null) {
        return options.includeMissing;
      }
      if (options.mode !== 'display') {
        if (!matchElements) {
          return selected.has(value);
        }
        return getValueSetCandidates(field, value).some((candidate) => selected.has(candidate));
      }
      let display = displays.get(field);
      if (!display) {
        display = options.displayConfig
          ? getDisplayProcessor({
              theme: fallbackTheme,
              field: { ...field, config: options.displayConfig },
              timeZone: options.timeZone,
            })
          : (field.display ?? getDisplayProcessor({ theme: fallbackTheme, field, timeZone: options.timeZone }));
        displays.set(field, display);
      }
      if (!matchElements) {
        return selected.has(formattedValueToString(display(value)));
      }
      return getValueSetCandidates(field, value).some((candidate) =>
        selected.has(formattedValueToString(display(candidate)))
      );
    };
  },
  getOptionsDisplayText: (options) => `Is in set: ${Array.isArray(options.values) ? options.values.join(', ') : ''}`,
};
