import { getDisplayProcessor } from '../../../field/displayProcessor';
import { createTheme } from '../../../themes/createTheme';
import { type Field, type FieldConfig } from '../../../types/dataFrame';
import { type ValueMatcherInfo } from '../../../types/transformations';
import { formattedValueToString } from '../../../valueFormats/baseFormatters';
import { ValueMatcherID } from '../ids';

export interface ValueSetOptions {
  values: unknown[];
  mode?: 'raw' | 'display';
  displayConfig?: FieldConfig;
  timeZone?: string;
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
    return (index, field) => {
      const value = field.values[index];
      if (options.mode !== 'display') {
        return selected.has(value);
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
      return selected.has(formattedValueToString(display(value)));
    };
  },
  getOptionsDisplayText: (options) => `Is in set: ${options.values.join(', ')}`,
};

export interface NumericRangeOptions {
  min?: number;
  max?: number;
  includeMissing: boolean;
}

export const numericRangeMatcher: ValueMatcherInfo<NumericRangeOptions> = {
  id: ValueMatcherID.numericRange,
  name: 'Is in numeric range',
  description: 'Matches inclusive, optionally open numeric or timestamp bounds.',
  // The transformation editor does not yet provide controls for this matcher.
  isApplicable: () => false,
  getDefaultOptions: () => ({ includeMissing: false }),
  get:
    ({ min, max, includeMissing }) =>
    (index, field) => {
      const value = field.values[index];
      return typeof value !== 'number' || !Number.isFinite(value)
        ? includeMissing
        : (min == null || value >= min) && (max == null || value <= max);
    },
  getOptionsDisplayText: ({ min, max }) => `From ${min ?? '-∞'} to ${max ?? '∞'} (inclusive)`,
};
