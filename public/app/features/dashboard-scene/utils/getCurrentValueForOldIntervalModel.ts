import type { IntervalVariableModel } from '@grafana/data';

export function getCurrentValueForOldIntervalModel(variable: IntervalVariableModel, intervals: string[]): string {
  // Handle missing current object or value
  const currentValue = variable.current?.value;
  const selectedInterval = Array.isArray(currentValue) ? currentValue[0] : currentValue;

  // If no intervals are available, return empty string (will use default from IntervalVariable)
  if (intervals.length === 0) {
    return '';
  }

  // If no selected interval, return the first valid interval
  if (!selectedInterval) {
    return intervals[0];
  }

  // If the interval is the old auto format, return the new auto interval from scenes.
  if (selectedInterval.startsWith('$__auto_interval_') || selectedInterval === '$__auto') {
    return '$__auto';
  }

  // Check if the selected interval is valid.
  if (intervals.includes(selectedInterval)) {
    return selectedInterval;
  }

  // If the selected interval is not valid, return the first valid interval.
  return intervals[0];
}
