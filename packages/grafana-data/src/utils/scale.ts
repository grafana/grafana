import { Field, Threshold, ScaleCalculator, ScaleMode, GrafanaTheme, GrafanaThemeType, Scale } from '../types';
import { reduceField, ReducerID } from '../transformations';
import { getColorFromHexRgbOrName } from './namedColorsPalette';

export function getScaleCalculator(field: Field, theme?: GrafanaTheme): ScaleCalculator {
  const themeType = theme ? theme.type : GrafanaThemeType.Dark;
  const scale = field.config?.scale;
  if (!scale) {
    return (value: number) => {
      return {}; // NOOP
    };
  }
  if (scale.mode === ScaleMode.absolute) {
    return (value: number) => {
      const threshold = getActiveThreshold(value, scale.thresholds);
      return {
        threshold,
        color: getColorFromHexRgbOrName(threshold.color, themeType),
      };
    };
  }
  const stats = reduceField({ field, reducers: [ReducerID.min, ReducerID.max] });
  const min = stats[ReducerID.min];
  const max = stats[ReducerID.max];
  const delta = max - min;
  return (value: number) => {
    const percent = (value - min) / delta;
    const threshold = getActiveThreshold(percent * 100, scale.thresholds);
    return {
      percent,
      threshold,
      color: getColorFromHexRgbOrName(threshold.color, themeType),
    };
  };
}

/**
 * Mutates the scale making the first value -Infinity
 */
export function validateScale(scale: Scale) {
  // First value is always -Infinity
  if (scale.thresholds && scale.thresholds.length) {
    scale.thresholds[0].value = -Infinity;
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

function getColorFromThreshold(value: number, thresholds: Threshold[], theme?: GrafanaTheme): string {
  const themeType = theme ? theme.type : GrafanaThemeType.Dark;

  if (thresholds.length === 1) {
    return getColorFromHexRgbOrName(thresholds[0].color, themeType);
  }

  const atThreshold = thresholds.filter(threshold => value === threshold.value)[0];
  if (atThreshold) {
    return getColorFromHexRgbOrName(atThreshold.color, themeType);
  }

  const belowThreshold = thresholds.filter(threshold => value > threshold.value);

  if (belowThreshold.length > 0) {
    const nearestThreshold = belowThreshold.sort((t1, t2) => t2.value - t1.value)[0];
    return getColorFromHexRgbOrName(nearestThreshold.color, themeType);
  }

  // Use the first threshold as the default color
  return getColorFromHexRgbOrName(thresholds[0].color, themeType);
}
