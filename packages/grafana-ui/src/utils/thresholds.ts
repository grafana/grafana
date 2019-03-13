import { Threshold } from '../types';

export function getThresholdForValue(
  thresholds: Threshold[],
  value: number | null | string | undefined
): Threshold | null {
  if (thresholds.length === 1) {
    return thresholds[0];
  }

  const atThreshold = thresholds.filter(threshold => (value as number) === threshold.value)[0];
  if (atThreshold) {
    return atThreshold;
  }

  const belowThreshold = thresholds.filter(threshold => (value as number) > threshold.value);
  if (belowThreshold.length > 0) {
    const nearestThreshold = belowThreshold.sort((t1: Threshold, t2: Threshold) => t2.value - t1.value)[0];
    return nearestThreshold;
  }

  return null;
}
