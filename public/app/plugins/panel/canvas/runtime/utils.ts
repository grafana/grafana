import { PanelData } from '@grafana/data';
import {
  getColorDimension,
  getScaledDimension,
  getTextDimension,
  getResourceDimension,
  ColorDimensionConfig,
  DimensionSupplier,
  ResourceDimensionConfig,
  ScaleDimensionConfig,
  TextDimensionConfig,
} from 'app/features/dimensions';
import { config } from '@grafana/runtime';

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
