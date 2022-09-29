import {
  DataFrame,
  Field,
  getDisplayProcessor,
  getFieldColorModeForField,
  GrafanaTheme2,
  getFieldConfigWithMinMax,
} from '@grafana/data';

import { ColorDimensionConfig, DimensionSupplier } from './types';
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

export function getColorDimensionForField(
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
    const config = getFieldConfigWithMinMax(field, true);
    if (config !== field.config) {
      field = { ...field, config };
      field.state = undefined;
    }

    const disp = getDisplayProcessor({ field, theme });
    const getColor = (value: any): string => {
      return disp(value).color ?? '#ccc';
    };

    return {
      field,
      get: (index: number): string => getColor(field!.values.get(index)),
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
