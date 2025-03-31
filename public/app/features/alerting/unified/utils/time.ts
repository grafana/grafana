import { rangeUtil } from '@grafana/data';

import { TimeOptions } from '../types/time';

/**
 * ⚠️
 * Some of these functions might be confusing, but there is a significant difference between "Golang duration",
 * supported by the time.ParseDuration() function and "prometheus duration" which is similar but does not support anything
 * smaller than seconds and adds the following supported units: "d, w, y"
 */

export function parseInterval(value: string): [number, string] {
  const match = value.match(/(\d+)(\w+)/);
  if (match) {
    return [Number(match[1]), match[2]];
  }
  throw new Error(`Invalid interval description: ${value}`);
}

export function intervalToSeconds(interval: string): number {
  const { sec, count } = rangeUtil.describeInterval(interval);
  return sec * count;
}

export const timeOptions = Object.entries(TimeOptions).map(([key, value]) => ({
  label: key[0].toUpperCase() + key.slice(1),
  value: value,
}));

export function isValidPrometheusDuration(duration: string): boolean {
  try {
    parsePrometheusDuration(duration);
    return true;
  } catch (err) {
    return false;
  }
}

const PROMETHEUS_SUFFIX_MULTIPLIER: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
  y: 365 * 24 * 60 * 60 * 1000,
};

const DURATION_REGEXP = new RegExp(/^(?:(?<value>\d+)(?<type>ms|s|m|h|d|w|y))|0$/);
const INVALID_FORMAT = new Error(
  `Must be of format "(number)(unit)", for example "1m", or just "0". Available units: ${Object.values(
    TimeOptions
  ).join(', ')}`
);

/**
 * According to https://prometheus.io/docs/alerting/latest/configuration/#configuration-file
 * see <duration>
 *
 * @returns Duration in milliseconds
 */
export function parsePrometheusDuration(duration: string): number {
  let input = duration;
  const parts: Array<[number, string]> = [];

  function matchDuration(part: string) {
    const match = DURATION_REGEXP.exec(part);
    const hasValueAndType = match?.groups?.value && match?.groups?.type;

    if (!match || !hasValueAndType) {
      throw INVALID_FORMAT;
    }

    if (match && match.groups?.value && match.groups?.type) {
      input = input.replace(match[0], '');
      parts.push([Number(match.groups.value), match.groups.type]);
    }

    if (input) {
      matchDuration(input);
    }
  }

  matchDuration(duration);

  if (!parts.length) {
    throw INVALID_FORMAT;
  }

  const totalDuration = parts.reduce((acc, [value, type]) => {
    const duration = value * PROMETHEUS_SUFFIX_MULTIPLIER[type];
    return acc + duration;
  }, 0);

  return totalDuration;
}

/**
 * Formats the given duration in milliseconds into a human-readable string representation.
 *
 * @param milliseconds - The duration in milliseconds.
 * @returns The formatted duration string.
 */
export function formatPrometheusDuration(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const years = Math.floor(days / 365);

  // we'll make an exception here for 0, 0ms seems a bit weird
  if (milliseconds === 0) {
    return '0s';
  }

  const timeUnits: Array<[number, string]> = [
    [years, 'y'],
    [weeks % 52, 'w'],
    [(days % 365) - 7 * (weeks % 52), 'd'],
    [hours % 24, 'h'],
    [minutes % 60, 'm'],
    [seconds % 60, 's'],
    [milliseconds % 1000, 'ms'],
  ];

  return (
    timeUnits
      // remove all 0 values
      .filter(([time]) => time > 0)
      // join time and unit
      .map(([time, unit]) => time + unit)
      .join('')
  );
}

/**
 * Parses a Prometheus duration string and returns the duration in milliseconds.
 * If the duration is invalid, it returns 0.
 *
 * @param duration - The Prometheus duration string to parse.
 * @returns The duration in milliseconds.
 */
export const safeParsePrometheusDuration = (duration: string): number => {
  try {
    return parsePrometheusDuration(duration);
  } catch (e) {
    return 0;
  }
};

export const isNullDate = (date: string) => {
  return date.includes('0001-01-01T00');
};

// Format given time span in MS to the largest single unit duration string up to hours.
export function msToSingleUnitDuration(rangeMs: number): string {
  if (rangeMs % (1000 * 60 * 60) === 0) {
    return rangeMs / (1000 * 60 * 60) + 'h';
  }
  if (rangeMs % (1000 * 60) === 0) {
    return rangeMs / (1000 * 60) + 'm';
  }
  if (rangeMs % 1000 === 0) {
    return rangeMs / 1000 + 's';
  }
  return rangeMs.toFixed() + 'ms';
}
