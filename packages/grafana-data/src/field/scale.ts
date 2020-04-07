import { Field, Threshold, GrafanaTheme, GrafanaThemeType, ThresholdsMode, FieldColorMode } from '../types';
import { reduceField, ReducerID } from '../transformations';
import { getColorFromHexRgbOrName } from '../utils/namedColorsPalette';
import * as d3 from 'd3-scale-chromatic';
import isNumber from 'lodash/isNumber';

export interface ScaledValue {
  percent?: number; // 0-1
  threshold?: Threshold; // the selected step
  color?: string; // Selected color (may be range based on threshold)
}

export type ScaleCalculator = (value: number) => ScaledValue;

/**
 * @param t Number in the range [0, 1].
 */
type colorInterpolator = (t: number) => string;

export function getScaleCalculator(field: Field, theme?: GrafanaTheme): ScaleCalculator {
  const themeType = theme ? theme.type : GrafanaThemeType.Dark;
  const config = field.config || {};
  const { thresholds, color } = config;

  const fixedColor =
    color && color.mode === FieldColorMode.Fixed && color.fixedColor
      ? getColorFromHexRgbOrName(color.fixedColor, themeType)
      : undefined;

  // Should we calculate the percentage
  const percentThresholds = thresholds && thresholds.mode === ThresholdsMode.Percentage;
  const useColorScheme = color && color.mode === FieldColorMode.Scheme;

  if (percentThresholds || useColorScheme) {
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

    if (useColorScheme) {
      interpolator = (d3 as any)[`interpolate${color!.schemeName}`] as colorInterpolator;
    }

    return (value: number) => {
      const percent = (value - min!) / delta;
      const threshold = thresholds
        ? getActiveThreshold(percentThresholds ? percent * 100 : value, thresholds.steps)
        : undefined; // 0-100
      let color = fixedColor;

      if (interpolator) {
        color = interpolator(percent);
      } else if (threshold) {
        color = getColorFromHexRgbOrName(threshold!.color, themeType);
      }

      return {
        percent,
        threshold,
        color,
      };
    };
  }

  if (thresholds) {
    return (value: number) => {
      const threshold = getActiveThreshold(value, thresholds.steps);
      const color = fixedColor ?? (threshold ? getColorFromHexRgbOrName(threshold.color, themeType) : undefined);
      return {
        threshold,
        color,
      };
    };
  }

  // Constant color
  if (fixedColor) {
    return (value: number) => {
      return { color: fixedColor };
    };
  }

  // NO-OP
  return (value: number) => {
    return {};
  };
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
