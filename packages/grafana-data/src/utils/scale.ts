import {
  Field,
  Threshold,
  ScaleCalculator,
  ScaleMode,
  GrafanaTheme,
  GrafanaThemeType,
  Scale,
  ColorScheme,
} from '../types';
import { reduceField, ReducerID } from '../transformations';
import { getColorFromHexRgbOrName } from './namedColorsPalette';
import * as d3 from 'd3-scale-chromatic';
import isNumber from 'lodash/isNumber';

/**
 * @param t Number in the range [0, 1].
 */
type colorInterpolator = (t: number) => string;

export function getScaleCalculator(field: Field, theme?: GrafanaTheme): ScaleCalculator {
  const themeType = theme ? theme.type : GrafanaThemeType.Dark;
  const config = field.config || {};
  const scale = config.scale;
  if (!scale) {
    return (value: number) => {
      return {}; // NOOP
    };
  }
  const absolute = scale.mode === ScaleMode.absolute;
  if (absolute && !scale.scheme) {
    return (value: number) => {
      const threshold = getActiveThreshold(value, scale.thresholds);
      return {
        threshold,
        color: getColorFromHexRgbOrName(threshold.color, themeType),
      };
    };
  }
  // Calculate min/max if required
  let min = config.min;
  let max = config.max;
  if (!isNumber(min) || !isNumber(max)) {
    if (field.values && field.values.length) {
      const stats = reduceField({ field, reducers: [ReducerID.min, ReducerID.max] });
      if (!isNumber(min)) {
        min = stats[ReducerID.min];
      }
      if (!isNumber(max)) {
        max = stats[ReducerID.max];
      }
    } else {
      min = 0;
      max = 100;
    }
  }
  const delta = max! - min!;

  // Use a d3 color scale
  let interpolator: colorInterpolator | undefined;
  if (scale.scheme) {
    interpolator = (d3 as any)[`interpolate${scale.scheme}`] as colorInterpolator;
  }

  return (value: number) => {
    const percent = (value - min!) / delta;
    const threshold = getActiveThreshold(absolute ? value : percent * 100, scale.thresholds); // 0-100
    return {
      percent,
      threshold,
      color: interpolator ? interpolator(percent) : getColorFromHexRgbOrName(threshold.color, themeType),
    };
  };
}

/**
 * Mutates the scale making the first value -Infinity
 */
export function validateScale(scale: Scale) {
  if (!scale.mode) {
    scale.mode = ScaleMode.absolute;
  }
  if (!scale.thresholds) {
    scale.thresholds = [];
  } else if (scale.thresholds.length) {
    // First value is always -Infinity
    // JSON saves it as null
    scale.thresholds[0].value = -Infinity;
  }

  // Make sure scheme actually has a scheme!
  if (scale.mode === ScaleMode.scheme) {
    if (!scale.scheme) {
      scale.scheme = ColorScheme.BrBG;
    }
  } else if (scale.scheme) {
    delete scale.scheme;
  }
}

export function getActiveThreshold(value: number, thresholds: Threshold[]): Threshold {
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
