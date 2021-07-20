import { DataFrame, getFieldColorModeForField, getScaleCalculator, GrafanaTheme2 } from '@grafana/data';
import { ColorDimensionConfig, DimensionSupplier } from './types';
import { findField } from './utils';

//---------------------------------------------------------
// Color dimension
//---------------------------------------------------------

export function getColorDimension(
  frame: DataFrame,
  config: ColorDimensionConfig,
  theme: GrafanaTheme2
): DimensionSupplier<string> {
  const field = findField(frame, config.field);
  if (!field) {
    const v = config.fixed ?? 'grey';
    return {
      isAssumed: Boolean(config.field?.length) || !config.fixed,
      fixed: v,
      get: (i) => v,
    };
  }
  const mode = getFieldColorModeForField(field);
  if (!mode.isByValue) {
    const fixed = mode.getCalculator(field, theme)(0, 0);
    return {
      fixed,
      get: (i) => fixed,
      field,
    };
  }
  const scale = getScaleCalculator(field, theme);
  return {
    get: (i) => {
      const val = field.values.get(i);
      return scale(val).color;
    },
    field,
  };
}
