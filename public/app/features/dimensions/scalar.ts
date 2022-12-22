import { DataFrame, Field } from '@grafana/data';

import { DimensionSupplier, ScalarDimensionConfig, ScalarDimensionMode } from './types';
import { findField, getLastNotNullFieldValue } from './utils';

//---------------------------------------------------------
// Scalar dimension
//---------------------------------------------------------
export function getScalarDimension(
  frame: DataFrame | undefined,
  config: ScalarDimensionConfig
): DimensionSupplier<number> {
  return getScalarDimensionForField(findField(frame, config?.field), config);
}
export function getScalarDimensionForField(
  field: Field | undefined,
  cfg: ScalarDimensionConfig
): DimensionSupplier<number> {
  if (!field) {
    const v = cfg.fixed ?? 0;
    return {
      isAssumed: Boolean(cfg.field?.length) || !cfg.fixed,
      fixed: v,
      value: () => v,
      get: () => v,
    };
  }

  //mod mode as default
  let validated = (value: number) => {
    return value % cfg.max;
  };

  //capped mode
  if (cfg.mode === ScalarDimensionMode.Clamped) {
    validated = (value: number) => {
      if (value < cfg.min) {
        return cfg.min;
      }
      if (value > cfg.max) {
        return cfg.max;
      }
      return value;
    };
  }

  const get = (i: number) => {
    const v = field.values.get(i);
    if (v === null || typeof v !== 'number') {
      return 0;
    }
    return validated(v);
  };

  return {
    field,
    get,
    value: () => getLastNotNullFieldValue(field),
  };
}
