import { type FieldConfig } from '@grafana/data';
import { ScaleDistribution, type ScaleDistributionConfig } from '@grafana/schema';

// Same custom field config key as the time series axis scale, so the setting survives a visualization change.
export function getGaugeScaleDistribution(field: FieldConfig): ScaleDistributionConfig | undefined {
  return field.custom?.scaleDistribution;
}

// A log scale needs a positive, increasing range; anything else falls back to linear.
function isLogScale(min: number, max: number, scale?: ScaleDistributionConfig): boolean {
  return scale?.type === ScaleDistribution.Log && min > 0 && max > min;
}

/**
 * Returns where a value sits between min (0) and max (1) on the given scale.
 * Values outside the range give results outside 0..1, except on a log scale, where
 * values below min (including zero and negatives) are pinned to 0.
 */
export function getScaledPercent(value: number, min: number, max: number, scale?: ScaleDistributionConfig): number {
  if (!isLogScale(min, max, scale)) {
    return (value - min) / (max - min);
  }

  return Math.log(Math.max(value, min) / min) / Math.log(max / min);
}

/**
 * Inverse of getScaledPercent: returns the value at a position between min (0) and max (1).
 */
export function getValueForScaledPercent(
  percent: number,
  min: number,
  max: number,
  scale?: ScaleDistributionConfig
): number {
  if (!isLogScale(min, max, scale)) {
    return min + (max - min) * percent;
  }

  return min * Math.pow(max / min, percent);
}
