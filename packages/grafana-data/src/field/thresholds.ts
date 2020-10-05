import { Threshold, FALLBACK_COLOR, Field, ThresholdsMode } from '../types';

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

export function getActiveThresholdForValue(field: Field, value: number, percent: number): Threshold {
  const { thresholds } = field.config;

  if (thresholds?.mode === ThresholdsMode.Percentage) {
    return getActiveThreshold(percent * 100 * value, thresholds?.steps);
  }

  return getActiveThreshold(value, thresholds?.steps);
}

/**
 * Sorts the thresholds
 */
export function sortThresholds(thresholds: Threshold[]) {
  return thresholds.sort((t1, t2) => {
    return t1.value - t2.value;
  });
}
