import { Threshold, FALLBACK_COLOR, Field, ThresholdsMode } from '../types';

export const fallBackTreshold: Threshold = { value: 0, color: FALLBACK_COLOR };

export function getActiveThreshold(value: number, thresholds: Threshold[] | undefined): Threshold {
  if (!thresholds || thresholds.length === 0) {
    return fallBackTreshold;
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

export function getActiveThresholdForValue(field: Field, value: number, percent: number): Threshold {
  const { thresholds } = field.config;

  if (thresholds?.mode === ThresholdsMode.Percentage) {
    return getActiveThreshold(percent * 100, thresholds?.steps);
  }

  return getActiveThreshold(value, thresholds?.steps);
}

/**
 * Sorts the thresholds
 */
export function sortThresholds(thresholds: Threshold[]) {
  return thresholds.sort((t1, t2) => t1.value - t2.value);
}
