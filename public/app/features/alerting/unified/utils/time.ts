import { durationToMilliseconds, parseDuration } from '@grafana/data';
import { describeInterval } from '@grafana/data/src/datetime/rangeutil';

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
  const { sec, count } = describeInterval(interval);
  return sec * count;
}

export const timeOptions = Object.entries(TimeOptions).map(([key, value]) => ({
  label: key[0].toUpperCase() + key.slice(1),
  value: value,
}));

export function parseDurationToMilliseconds(duration: string) {
  return durationToMilliseconds(parseDuration(duration));
}

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
  let parts: Array<[number, string]> = [];

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
