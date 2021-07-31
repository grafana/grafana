import { PanelData } from '@grafana/data';
import { getColorDimension } from '../../geomap/dims/color';
import { ColorDimensionConfig, DimensionSupplier, ScaleDimensionConfig } from '../../geomap/dims/types';
import { config } from '@grafana/runtime';
import { getScaledDimension } from '../../geomap/dims/scale';

export function getColorDimensionFromData(
  data: PanelData | undefined,
  cfg: ColorDimensionConfig
): DimensionSupplier<string> {
  if (data?.series) {
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
  if (data?.series) {
    for (const frame of data.series) {
      const d = getScaledDimension(frame, cfg);
      if (!d.isAssumed || data.series.length === 1) {
        return d;
      }
    }
  }
  return getScaledDimension(undefined, cfg);
}
