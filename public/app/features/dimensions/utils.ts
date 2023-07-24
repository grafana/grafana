import { DataFrame, PanelData, Field, getFieldDisplayName, ReducerID } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  ResourceDimensionConfig,
  ScaleDimensionConfig,
  TextDimensionConfig,
  ColorDimensionConfig,
  ScalarDimensionConfig,
} from '@grafana/schema';
import {
  getColorDimension,
  getScaledDimension,
  getTextDimension,
  getResourceDimension,
  DimensionSupplier,
} from 'app/features/dimensions';

import { getScalarDimension } from './scalar';

export function getColorDimensionFromData(
  data: PanelData | undefined,
  cfg: ColorDimensionConfig
): DimensionSupplier<string> {
  if (data?.series && cfg.field) {
    for (const frame of data.series) {
      const d = getColorDimension(frame, cfg, config.theme2);
      if (!d.isAssumed || data.series.length === 1) {
        return d;
      }
    }
  }
  return getColorDimension(undefined, cfg, config.theme2);
}

export function getScaleDimensionFromData(
  data: PanelData | undefined,
  cfg: ScaleDimensionConfig
): DimensionSupplier<number> {
  if (data?.series && cfg.field) {
    for (const frame of data.series) {
      const d = getScaledDimension(frame, cfg);
      if (!d.isAssumed || data.series.length === 1) {
        return d;
      }
    }
  }
  return getScaledDimension(undefined, cfg);
}

export function getScalarDimensionFromData(
  data: PanelData | undefined,
  cfg: ScalarDimensionConfig
): DimensionSupplier<number> {
  if (data?.series && cfg.field) {
    for (const frame of data.series) {
      const d = getScalarDimension(frame, cfg);
      if (!d.isAssumed || data.series.length === 1) {
        return d;
      }
    }
  }
  return getScalarDimension(undefined, cfg);
}

export function getResourceDimensionFromData(
  data: PanelData | undefined,
  cfg: ResourceDimensionConfig
): DimensionSupplier<string> {
  if (data?.series && cfg.field) {
    for (const frame of data.series) {
      const d = getResourceDimension(frame, cfg);
      if (!d.isAssumed || data.series.length === 1) {
        return d;
      }
    }
  }
  return getResourceDimension(undefined, cfg);
}

export function getTextDimensionFromData(
  data: PanelData | undefined,
  cfg: TextDimensionConfig
): DimensionSupplier<string> {
  if (data?.series && cfg.field) {
    for (const frame of data.series) {
      const d = getTextDimension(frame, cfg);
      if (!d.isAssumed || data.series.length === 1) {
        return d;
      }
    }
  }
  return getTextDimension(undefined, cfg);
}

export function findField(frame?: DataFrame, name?: string): Field | undefined {
  const idx = findFieldIndex(frame, name);
  return idx == null ? undefined : frame!.fields[idx];
}

export function findFieldIndex(frame?: DataFrame, name?: string): number | undefined {
  if (!frame || !name?.length) {
    return undefined;
  }

  for (let i = 0; i < frame.fields.length; i++) {
    const field = frame.fields[i];
    if (name === field.name) {
      return i;
    }
    const disp = getFieldDisplayName(field, frame);
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
  return undefined as any;
}
