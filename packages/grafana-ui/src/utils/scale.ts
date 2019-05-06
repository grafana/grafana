import * as d3 from 'd3-scale-chromatic';
import { Field, Threshold } from '../types/index';

export interface FieldScaleInfo {
  color: string;
  percent?: number; // 0-1
  state?: string; // Warning, Error, LowLow, Low, OK, High, HighHigh etc
}

export type FieldScaleInterpolator = (value: number) => FieldScaleInfo;

/**
 * @param t Number in the range [0, 1].
 */
type colorInterpolator = (t: number) => string;

export function getFieldScaleInterpolator(field: Field): FieldScaleInterpolator | null {
  const { scale } = field;
  if (!scale) {
    return null;
  }

  // Check if we should calculate percentage
  if (scale.scheme && !isNaN(field.min!) && !isNaN(field.max!) && field.min !== field.max) {
    let interpolator: colorInterpolator;
    if (scale.scheme) {
      interpolator = d3.interpolateBlues;
    }
    const min = Math.min(field.min!, field.max!);
    const max = Math.max(field.min!, field.max!);
    const size = max - min;

    return (value: number) => {
      if (value > max) value = max;
      else if (value < min) value = min;

      const percent = (value - min) / size;
      const info = {
        percent,
        color: interpolator(percent),
      } as FieldScaleInfo;

      // Use the scale colors / state if configured
      if (scale.thresholds && scale.thresholds.length) {
        const t = getActiveThreshold(value, scale.thresholds);
        if (t.color) {
          info.color = t.color;
        }
        if (t.state) {
          info.state = t.state;
        }
      }
      return info;
    };
  }

  if (scale.thresholds && scale.thresholds.length) {
    return (value: number) => {
      const t = getActiveThreshold(value, scale.thresholds!);
      return {
        color: t.color,
        state: t.state,
      } as FieldScaleInfo;
    };
  }

  // Nothing to scale
  return null;
}

function getActiveThreshold(value: number, thresholds: Threshold[]): Threshold {
  let active = thresholds[0];
  for (const threshold of thresholds) {
    if (value >= threshold.value) {
      active = threshold;
    } else {
      break;
    }
  }
  return active;
}
