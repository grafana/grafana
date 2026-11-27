import { type DataFrame, type PanelData, type Field, getFieldDisplayName, ReducerID } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  type ResourceDimensionConfig,
  type ScaleDimensionConfig,
  type TextDimensionConfig,
  type ColorDimensionConfig,
  type ScalarDimensionConfig,
  type DirectionDimensionConfig,
  type ConnectionDirection,
} from '@grafana/schema';

import { type DimensionSupplier } from './types';

export function findField(frame?: DataFrame, name?: string): Field | undefined {
  const idx = findFieldIndex(name, frame);
  return idx == null ? undefined : frame!.fields[idx];
}

export function findFieldIndex(name?: string, frame?: DataFrame, frames?: DataFrame[]): number | undefined {
  if (!frame || !name?.length) {
    return undefined;
  }

  for (let i = 0; i < frame.fields.length; i++) {
    const field = frame.fields[i];
    if (name === field.name) {
      return i;
    }
    const disp = getFieldDisplayName(field, frame, frames);
    if (name === disp) {
      return i;
    }
  }
  return undefined;
}

export function getLastNotNullFieldValue<T>(field: Field): T {
  const calcs = field.state?.calcs;
  if (calcs) {
    const v = calcs[ReducerID.lastNotNull];
    if (v != null) {
      return v;
    }
  }

  const data = field.values;
  let idx = data.length - 1;
  while (idx >= 0) {
    const v = data[idx--];
    if (v != null) {
      return v;
    }
  }
  return undefined as T;
}
