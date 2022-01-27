import { DataFrame, Field, GrafanaTheme2 } from '@grafana/data';
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
    const v = theme.visualization.getColorByName(config.fixed) ?? 'grey';
    return {
      isAssumed: Boolean(config.field?.length) || !config.fixed,
      fixed: v,
      value: () => v,
      get: (i) => v,
    };
  }

  const getColor = (value: any): string => {
    const disp = field.display!;
    return disp(value).color ?? '#ccc';
  };

  return {
    field,
    get: (index: number): string => getColor(field.values.get(index)),
    value: () => getColor(getLastNotNullFieldValue(field)),
  };
}
