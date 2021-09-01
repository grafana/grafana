import { describeInterval } from '@grafana/data/src/datetime/rangeutil';
import { TimeOptions } from '../types/time';

export function parseInterval(value: string): [number, string] {
  const match = value.match(/(\d+)(\w+)/);
  if (match) {
    return [Number(match[1]), match[2]];
  }
  throw new Error(`Invalid interval description: ${value}`);
}

export function intervalToSeconds(interval: string): number {
  const { sec, count } = describeInterval(interval);
  return sec * count;
}

export const timeOptions = Object.entries(TimeOptions).map(([key, value]) => ({
  label: key[0].toUpperCase() + key.slice(1),
  value: value,
}));

// 1h, 10m and such
export const positiveDurationValidationPattern = {
  value: new RegExp(`^\\d+(${Object.values(TimeOptions).join('|')})$`),
  message: `Must be of format "(number)(unit)" , for example "1m". Available units: ${Object.values(TimeOptions).join(
    ', '
  )}`,
};

// 1h, 10m or 0 (without units)
export const durationValidationPattern = {
  value: new RegExp(`^\\d+(${Object.values(TimeOptions).join('|')})|0$`),
  message: `Must be of format "(number)(unit)", for example "1m", or just "0". Available units: ${Object.values(
    TimeOptions
  ).join(', ')}`,
};
