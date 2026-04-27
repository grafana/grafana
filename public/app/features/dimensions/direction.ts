import { type DataFrame, type Field } from '@grafana/data/dataframe';
import { ConnectionDirection, type DirectionDimensionConfig, DirectionDimensionMode } from '@grafana/schema';

import { type DimensionSupplier } from './types';
import { findField, getLastNotNullFieldValue } from './utils';

//---------------------------------------------------------
// Direction dimension
//---------------------------------------------------------

export function getDirectionDimension(
  frame: DataFrame | undefined,
  config: DirectionDimensionConfig
): DimensionSupplier<ConnectionDirection> {
  return getDirectionDimensionForField(findField(frame, config.field), config);
}

export function getDirectionDimensionForField(
  field: Field | undefined,
  config: DirectionDimensionConfig
): DimensionSupplier<ConnectionDirection> {
  const mode = config.mode ?? DirectionDimensionMode.Fixed;

  if (mode === DirectionDimensionMode.Fixed || !field) {
    const v = config.fixed ?? ConnectionDirection.Forward;
    return {
      isAssumed: Boolean(config.field?.length) || !config.fixed,
      fixed: v,
      value: () => v,
      get: () => v,
    };
  }

  const getDirectionFromValue = (value: unknown): ConnectionDirection => {
    if (value == null) {
      return ConnectionDirection.Forward;
    }

    const numValue = Number(value);
    if (isNaN(numValue)) {
      return ConnectionDirection.Forward;
    }

    if (numValue > 0) {
      return ConnectionDirection.Forward;
    } else if (numValue < 0) {
      return ConnectionDirection.Reverse;
    } else {
      return ConnectionDirection.None;
    }
  };

  return {
    field,
    get: (index: number): ConnectionDirection => getDirectionFromValue(field.values[index]),
    value: () => getDirectionFromValue(getLastNotNullFieldValue(field)),
  };
}
