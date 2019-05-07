import * as d3 from 'd3-scale-chromatic';
import { Field, GrafanaTheme, GrafanaThemeType } from '../types/index';
import { getColorFromHexRgbOrName } from './namedColorsPalette';
import { Threshold, Scale } from '../types/scale';
import { colors } from './colors';
import { getTheme } from '../themes/index';

export interface ScaledValueInfo {
  color: string;
  percent: number; // 0-1
  state?: string; // Warning, Error, LowLow, Low, OK, High, HighHigh etc
}

export type FieldScaleInterpolator = (value: number) => ScaledValueInfo;

export interface FieldDisplayProcessor {
  minValue: number;
  maxValue: number;
  scale: Scale;
  interpolate: FieldScaleInterpolator;
}

/**
 * @param t Number in the range [0, 1].
 */
type colorInterpolator = (t: number) => string;

const dummyInterpolator = (value: number) => {
  return { color: 'grey', percent: 0 };
};
const defaultScale: Scale = {
  thresholds: [{ value: -Infinity, color: colors[0] }],
};

export function getFieldDisplayProcessor(field: Partial<Field>, theme?: GrafanaTheme): FieldDisplayProcessor {
  let interpolate: FieldScaleInterpolator = dummyInterpolator;
  const scale = field.scale ? field.scale : defaultScale;
  if (!theme) {
    theme = getTheme(GrafanaThemeType.Dark);
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

  // Make sure it is a valid scale
  let min = isNaN(field.min!) ? 0 : field.min!;
  let max = isNaN(field.max!) ? 100 : field.max!;
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
    let color = d3.interpolateCool;
    if (scale.discrete) {
      const colors = (d3 as any)[`scheme${scale.scheme}`][scale.discrete];
      if (colors) {
        color = (t: number) => {
          return colors[Math.floor(t * colors.length)];
        };
      }
    } else {
      color = (d3 as any)[`interpolate${scale.scheme}`] as colorInterpolator;
    }
    if (!color) {
      throw new Error('Unknown scheme:' + scale.scheme);
    }

    interpolate = (value: number) => {
      const percent = getPercent(value);
      const info = {
        percent,
        color: color(percent),
      } as ScaledValueInfo;

      // Use the scale colors / state if configured
      if (thresholds && thresholds.length) {
        const t = getActiveThreshold(value, thresholds);
        if (t.color) {
          info.color = getColorFromHexRgbOrName(t.color, theme!.type);
        }
        if (t.state) {
          info.state = t.state;
        }
      }
      return info;
    };
  } else if (thresholds && thresholds.length) {
    interpolate = (value: number) => {
      const t = getActiveThreshold(value, thresholds);
      return {
        percent: getPercent(value),
        color: getColorFromHexRgbOrName(t.color, theme!.type),
        state: t.state,
      } as ScaledValueInfo;
    };
  }

  return {
    minValue: min,
    maxValue: max,
    scale,
    interpolate,
  };
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

/**
 * Sorts the thresholds
 */
export function sortThresholds(thresholds: Threshold[]) {
  return thresholds.sort((t1, t2) => {
    return t1.value - t2.value;
  });
}
