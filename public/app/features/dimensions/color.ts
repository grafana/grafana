import {
  type DataFrame,
  type Field,
  FieldType,
  getDisplayProcessor,
  getFieldColorModeForField,
  type GrafanaTheme2,
  getFieldConfigWithMinMax,
  type NumericRange,
  reduceField,
  ReducerID,
} from '@grafana/data';
import { type ColorDimensionConfig } from '@grafana/schema';

import { type DimensionSupplier } from './types';
import { findField, getLastNotNullFieldValue } from './utils';

//---------------------------------------------------------
// Color dimension
//---------------------------------------------------------

export function getColorDimension(
  frame: DataFrame | undefined,
  config: ColorDimensionConfig,
  theme: GrafanaTheme2
): DimensionSupplier<string> {
  return getColorDimensionForField(findField(frame, config.field), config, theme);
}

function getColorDimensionForField(
  field: Field | undefined,
  config: ColorDimensionConfig,
  theme: GrafanaTheme2
): DimensionSupplier<string> {
  if (!field) {
    const v = theme.visualization.getColorByName(config.fixed ?? 'grey');
    return {
      isAssumed: Boolean(config.field?.length) || !config.fixed,
      fixed: v,
      value: () => v,
      get: (i) => v,
    };
  }

  // Use the expensive color calculation by value
  const mode = getFieldColorModeForField(field);
  if (mode.isByValue || field.config.mappings?.length) {
    // Force this to use local min/max for range
    if (field.type === FieldType.time) {
      // The local min/max is only calculated for number fields, so time fields need their own range
      const range = getTimeFieldRange(field);
      if (range) {
        field = {
          ...field,
          config: { ...field.config, min: range.min, max: range.max },
          state: { ...field.state, range },
        };
      }
    } else {
      const config = getFieldConfigWithMinMax(field, true);
      if (config !== field.config) {
        field = { ...field, config };
        field.state = undefined;
      }
    }

    const disp = getDisplayProcessor({ field, theme });
    const getColor = (value: unknown): string => {
      return disp(value).color ?? '#ccc';
    };

    return {
      field,
      get: (index: number): string => getColor(field!.values[index]),
      value: () => getColor(getLastNotNullFieldValue(field!)),
    };
  }

  // Typically series or fixed color (does not depend on value)
  const fixed = mode.getCalculator(field, theme)(0, 0);
  return {
    fixed,
    value: () => fixed,
    get: (i) => fixed,
    field,
  };
}

function getTimeFieldRange(field: Field): NumericRange | undefined {
  const stats = reduceField({ field, reducers: [ReducerID.min, ReducerID.max] });
  const min = field.config.min ?? stats[ReducerID.min];
  const max = field.config.max ?? stats[ReducerID.max];

  if (typeof min !== 'number' || typeof max !== 'number') {
    return undefined;
  }

  return { min, max, delta: max - min };
}
