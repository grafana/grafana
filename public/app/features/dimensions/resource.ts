import { DataFrame } from '@grafana/data';
import { DimensionSupplier, ResourceDimensionConfig, ResourceDimensionMode } from './types';
import { findField, getLastNotNullFieldValue } from './utils';

//---------------------------------------------------------
// Resource dimension
//---------------------------------------------------------

export function getResourceDimension(
  frame: DataFrame | undefined,
  config: ResourceDimensionConfig
): DimensionSupplier<string> {
  const mode = config.mode ?? ResourceDimensionMode.Fixed;
  if (mode === ResourceDimensionMode.Fixed) {
    const v = config.fixed!;
    return {
      isAssumed: !Boolean(v),
      fixed: v,
      value: () => v,
      get: (i) => v,
    };
  }

  const field = findField(frame, config.field);
  if (!field) {
    const v = '';
    return {
      isAssumed: true,
      fixed: v,
      value: () => v,
      get: (i) => v,
    };
  }

  if (mode === ResourceDimensionMode.Mapping) {
    const mapper = (v: any) => `${v}`;
    return {
      field,
      get: (i) => mapper(field.values.get(i)),
      value: () => mapper(getLastNotNullFieldValue(field)),
    };
  }

  return {
    field,
    get: field.values.get,
    value: () => getLastNotNullFieldValue(field),
  };
}
