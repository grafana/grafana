import { type Field } from '../types/dataFrame';
import { FALLBACK_COLOR } from '../types/fieldColor';
import { type Threshold, ThresholdsMode } from '../types/thresholds';

export const fallBackThreshold: Threshold = { value: 0, color: FALLBACK_COLOR };

export function getActiveThreshold(value: number, thresholds: Threshold[] | undefined): Threshold {
  if (!thresholds || thresholds.length === 0) {
    return fallBackThreshold;
  }

  let active = thresholds[0];

  for (const threshold of thresholds) {
    // Processed field configs only contain numeric step values; a string (unresolved
    // variable expression) is treated like any non-matching value and ends the walk.
    if (typeof threshold.value === 'number' && value >= threshold.value) {
      active = threshold;
    } else {
      break;
    }
  }

  return active;
}

export function getActiveThresholdForValue(field: Field, value: number, percent: number): Threshold {
  const { thresholds } = field.config;

  if (thresholds?.mode === ThresholdsMode.Percentage) {
    return getActiveThreshold(percent * 100, thresholds?.steps);
  }

  return getActiveThreshold(value, thresholds?.steps);
}

/**
 * Sorts the thresholds in place, numeric values ascending. String values (unresolved variable
 * expressions) cannot be ordered at edit time, so they keep their relative order at the end.
 */
export function sortThresholds(thresholds: Threshold[]) {
  return thresholds.sort((t1, t2) => {
    if (typeof t1.value === 'string' || typeof t2.value === 'string') {
      if (typeof t1.value === typeof t2.value) {
        return 0;
      }
      return typeof t1.value === 'string' ? 1 : -1;
    }
    return t1.value - t2.value;
  });
}
