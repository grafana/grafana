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
    // Raw base steps may still be null (the JSON form of -Infinity) and match via coercion.
    if (typeof threshold.value !== 'string' && value >= threshold.value) {
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
 * Sorts the thresholds in place, numeric values ascending. Values that cannot be ordered
 * (strings with unresolved variable expressions) keep their relative order at the end.
 */
export function sortThresholds(thresholds: Threshold[]) {
  return thresholds.sort((t1, t2) => {
    // Coercing strings keeps legacy ordering for empty/numeric strings ('' sorts as 0);
    // variable expressions produce NaN and cannot be ordered until render time
    const v1 = typeof t1.value === 'string' ? Number(t1.value) : t1.value;
    const v2 = typeof t2.value === 'string' ? Number(t2.value) : t2.value;

    if (Number.isNaN(v1) || Number.isNaN(v2)) {
      if (Number.isNaN(v1) === Number.isNaN(v2)) {
        return 0;
      }
      return Number.isNaN(v1) ? 1 : -1;
    }

    return v1 - v2;
  });
}
