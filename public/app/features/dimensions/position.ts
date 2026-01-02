import { DataFrame, Field } from '@grafana/data';
import { PositionDimensionConfig, PositionDimensionMode } from '@grafana/schema';

import { DimensionSupplier } from './types';
import { findField, getLastNotNullFieldValue } from './utils';

//---------------------------------------------------------
// Position dimension - simple fixed or field value
//---------------------------------------------------------

export function getPositionDimension(
  frame: DataFrame | undefined,
  config: PositionDimensionConfig
): DimensionSupplier<number> {
  return getPositionDimensionForField(findField(frame, config?.field), config);
}

export function getPositionDimensionForField(
  field: Field | undefined,
  config: PositionDimensionConfig
): DimensionSupplier<number> {
  const v = config.fixed ?? 0;
  const mode = config.mode ?? PositionDimensionMode.Fixed;

  if (mode === PositionDimensionMode.Fixed) {
    return {
      isAssumed: !config.fixed,
      fixed: v,
      value: () => v,
      get: () => v,
    };
  }

  // Field mode
  if (!field) {
    return {
      isAssumed: true,
      fixed: v,
      value: () => v,
      get: () => v,
    };
  }

  const get = (i: number) => {
    const val = field.values[i];
    if (val === null || typeof val !== 'number') {
      return 0;
    }
    return val;
  };

  return {
    field,
    get,
    value: () => {
      const val = getLastNotNullFieldValue(field);
      return typeof val === 'number' ? val : 0;
    },
  };
}
