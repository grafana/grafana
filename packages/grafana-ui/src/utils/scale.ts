import * as d3 from 'd3-scale-chromatic';
import { Field, GrafanaThemeType } from '../types/index';
import { getColorFromHexRgbOrName } from './namedColorsPalette';
import { Threshold } from '../types/scale';

export interface ScaledValueInfo {
  color: string;
  percent?: number; // 0-1
  state?: string; // Warning, Error, LowLow, Low, OK, High, HighHigh etc
}

export type FieldScaleInterpolator = (value: number) => ScaledValueInfo;

/**
 * @param t Number in the range [0, 1].
 */
type colorInterpolator = (t: number) => string;

export function getFieldScaleInterpolator(
  field: Partial<Field>,
  theme = GrafanaThemeType.Dark
): FieldScaleInterpolator | null {
  const { scale } = field;
  if (!scale) {
    return null;
  }

  // Validate Thresholds
  const { thresholds } = scale;
  if (thresholds && thresholds.length) {
    // JSON serialization of -Infinity is 'null' so lets convert it back to -Infinity
    if (thresholds[0].value === null) {
      thresholds[0].value = -Infinity;
    }
    sortThresholds(thresholds);
  }

  // Get a valid
  let min = isNaN(field.min!) ? 0 : field.min!;
  let max = isNaN(field.max!) ? 0 : field.max!;
  if (min > max) {
    const temp = max;
    max = min;
    min = temp;
  }

  const size = max - min;
  const getPercent = (value: number) => {
    if (value >= max) {
      return 1;
    } else if (value <= min) {
      return 0;
    }
    if (min === max) {
      return 1; // Avoid divide by zero
    }
    return (value - min) / size;
  };

  // Check if we should calculate percentage
  if (scale.scheme) {
    let interpolator = d3.interpolateCool;
    if (scale.discrete) {
      const colors = (d3 as any)[`scheme${scale.scheme}`][scale.discrete];
      if (colors) {
        interpolator = (t: number) => {
          return colors[Math.floor(t * colors.length)];
        };
      }
    } else {
      interpolator = (d3 as any)[`interpolate${scale.scheme}`] as colorInterpolator;
    }
    if (!interpolator) {
      throw new Error('Unknown scheme:' + scale.scheme);
    }

    return (value: number) => {
      const percent = getPercent(value);
      const info = {
        percent,
        color: interpolator(percent),
      } as ScaledValueInfo;

      // Use the scale colors / state if configured
      if (thresholds && thresholds.length) {
        const t = getActiveThreshold(value, thresholds);
        if (t.color) {
          info.color = getColorFromHexRgbOrName(t.color, theme);
        }
        if (t.state) {
          info.state = t.state;
        }
      }
      return info;
    };
  }

  if (thresholds && thresholds.length) {
    return (value: number) => {
      const t = getActiveThreshold(value, thresholds);
      return {
        percent: getPercent(value),
        color: getColorFromHexRgbOrName(t.color!, theme),
        state: t.state,
      } as ScaledValueInfo;
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

interface BarGradientOptions {
  vertical: boolean;
  value: number;
  maxSize: number;
}

export interface ScaledFieldHelper {
  minValue: number;
  maxValue: number;

  interpolate: FieldScaleInterpolator;

  /**
   * The ordered list of threshold info
   */
  thresholds?: Threshold[];

  /**
   * Gets back a CSS Gradient from the configuration
   */
  gradient: (options: BarGradientOptions) => string;
}

export function getScaledFieldHelper(field: Field, theme = GrafanaThemeType.Dark): ScaledFieldHelper {
  const interpolate = getFieldScaleInterpolator(field, theme)!;
  const minValue = Math.min(field.min!, field.max!);
  const maxValue = Math.max(field.min!, field.max!);
  const thresholds = field.scale!.thresholds!; // HACK assume thresholds now

  return {
    minValue,
    maxValue,
    interpolate,
    thresholds,
    gradient: (options: BarGradientOptions) => {
      const cssDirection = options.vertical ? '0deg' : '90deg';

      let gradient = '';
      let lastpos = 0;

      for (let i = 0; i < thresholds.length; i++) {
        const threshold = thresholds[i];
        const color = getColorFromHexRgbOrName(threshold.color!);
        const valuePercent = Math.min(threshold.value / (maxValue - minValue), 1);
        const pos = valuePercent * options.maxSize;
        const offset = Math.round(pos - (pos - lastpos) / 2);

        if (gradient === '') {
          gradient = `linear-gradient(${cssDirection}, ${color}, ${color}`;
        } else if (options.value < threshold.value) {
          break;
        } else {
          lastpos = pos;
          gradient += ` ${offset}px, ${color}`;
        }
      }

      return gradient + ')';
    },
  };
}

/**
 * Sorts the thresholds
 */
export function sortThresholds(thresholds: Threshold[]) {
  return thresholds.sort((t1, t2) => {
    return t1.value - t2.value;
  });
}
