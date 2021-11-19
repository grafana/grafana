import { DataFrame, Field } from '@grafana/data';
import { DimensionSupplier, ScalerDimensionConfig, ScalerDimensionMode } from './types';
import { findField, getLastNotNullFieldValue } from './utils';

//---------------------------------------------------------
// Scaler dimension
//---------------------------------------------------------
export function getScalerDimension(
  frame: DataFrame | undefined,
  config: ScalerDimensionConfig
): DimensionSupplier<number> {
  return getScalerDimensionForField(findField(frame, config?.field), config);
}
export function getScalerDimensionForField(
  field: Field | undefined,
  cfg: ScalerDimensionConfig,
  mode?: ScalerDimensionMode
): DimensionSupplier<number> {
  //if there is no field
  if (!field) {
    const v = cfg.fixed ?? 0;
    return {
      isAssumed: Boolean(cfg.field?.length) || !cfg.fixed,
      fixed: v,
      value: () => v,
      get: () => v,
    };
  }

  //capped mode as default
  let validated = (value: number) => {
    if (value < cfg.min) {
      return cfg.min;
    }
    if (value > cfg.max) {
      return cfg.max;
    }
    return value;
  };

  //modulus mode
  if (mode === ScalerDimensionMode.Mod) {
    validated = (value: number) => {
      return value % cfg.max;
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
