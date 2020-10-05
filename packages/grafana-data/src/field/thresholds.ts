import { isNumber } from 'lodash';
import { reduceField, ReducerID } from '../transformations/fieldReducer';
import { Threshold, FALLBACK_COLOR, Field, ThresholdsMode, GrafanaTheme } from '../types';
import { getColorFromHexRgbOrName } from '../utils';

export function getActiveThreshold(value: number, thresholds: Threshold[] | undefined): Threshold {
  if (!thresholds || thresholds.length === 0) {
    return { value, color: FALLBACK_COLOR };
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

export function getColorFromThreshold(field: Field, seriesIndex: number, theme: GrafanaTheme) {
  const { thresholds } = field.config;

  if (thresholds?.mode === ThresholdsMode.Percentage) {
    const info = getMinMaxAndDelta(field);

    return (value: number) => {
      const percent = (value - info.min!) / info.delta;
      const threshold = getActiveThreshold(percent * 100 * value, thresholds?.steps);
      const color = getColorFromHexRgbOrName(threshold.color, theme.type);

      return {
        threshold,
        color,
      };
    };
  }

  return (value: number) => {
    const threshold = getActiveThreshold(value, thresholds?.steps);
    const color = getColorFromHexRgbOrName(threshold.color, theme.type);

    return {
      threshold,
      color,
    };
  };
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

/**
 * Sorts the thresholds
 */
export function sortThresholds(thresholds: Threshold[]) {
  return thresholds.sort((t1, t2) => {
    return t1.value - t2.value;
  });
}
