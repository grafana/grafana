import { Field, Threshold, GrafanaTheme, GrafanaThemeType, ThresholdsMode, FieldColorMode } from '../types';
import { reduceField, ReducerID } from '../transformations';
import { getColorFromHexRgbOrName } from '../utils/namedColorsPalette';
import { interpolateRgbBasis } from 'd3-interpolate';
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
type ColorInterpolator = (t: number) => string;

const DEFAULT_COLOR = 'gray';

export function getScaleCalculator(field: Field, theme?: GrafanaTheme): ScaleCalculator {
  const themeType = theme ? theme.type : GrafanaThemeType.Dark;
  const config = field.config || {};
  const { thresholds } = config;

  const color = config.color ?? { mode: FieldColorMode.Thresholds };

  if (color.mode === FieldColorMode.Fixed) {
    return (value: number) => {
      return {
        color: getColorFromHexRgbOrName(color.fixedColor ?? DEFAULT_COLOR, themeType),
      };
    };
  }

  if (color.mode === FieldColorMode.Thresholds) {
    if (thresholds?.mode === ThresholdsMode.Percentage) {
      const info = getMinMaxAndDelta(field);

      return (value: number) => {
        const percent = (value - info.min!) / info.delta;
        const threshold = getActiveThreshold(percent * 100 * value, thresholds?.steps);
        const color = getColorFromHexRgbOrName(threshold.color, themeType);

        return {
          threshold,
          color,
        };
      };
    }

    return (value: number) => {
      const threshold = getActiveThreshold(value, thresholds?.steps);
      const color = getColorFromHexRgbOrName(threshold.color, themeType);

      return {
        threshold,
        color,
      };
    };
  }

  const info = getMinMaxAndDelta(field);
  const colorFunc = getColorInterpolator(color.mode, themeType);

  return (value: number) => {
    const percent = (value - info.min!) / info.delta;
    return { color: colorFunc(percent) };
  };
}

function getColorInterpolator(mode: FieldColorMode, themeType: GrafanaThemeType): ColorInterpolator {
  switch (mode) {
    case FieldColorMode.SchemeBlues: {
      return interpolateRgbBasis([
        getColorFromHexRgbOrName('dark-blue', themeType),
        getColorFromHexRgbOrName('super-light-blue', themeType),
      ]);
    }
    case FieldColorMode.SchemeReds: {
      return interpolateRgbBasis([
        getColorFromHexRgbOrName('dark-red', themeType),
        getColorFromHexRgbOrName('super-light-red', themeType),
      ]);
    }
    case FieldColorMode.SchemeGreens: {
      return interpolateRgbBasis([
        getColorFromHexRgbOrName('dark-green', themeType),
        getColorFromHexRgbOrName('super-light-green', themeType),
      ]);
    }
    case FieldColorMode.SchemeGrYlRd: {
      return interpolateRgbBasis([
        getColorFromHexRgbOrName('green', themeType),
        getColorFromHexRgbOrName('yellow', themeType),
        getColorFromHexRgbOrName('red', themeType),
      ]);
    }
    default: {
      return (value: number) => DEFAULT_COLOR;
    }
  }
}

interface FieldMinMaxInfo {
  min?: number | null;
  max?: number | null;
  delta: number;
}

function getMinMaxAndDelta(field: Field): FieldMinMaxInfo {
  // Calculate min/max if required
  let min = field.config.min;
  let max = field.config.max;

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

  return {
    min,
    max,
    delta: max! - min!,
  };
}

export function getActiveThreshold(value: number, thresholds: Threshold[] | undefined): Threshold {
  if (!thresholds || thresholds.length === 0) {
    return { value, color: DEFAULT_COLOR };
  }

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
