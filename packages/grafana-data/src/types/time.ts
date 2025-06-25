import {
  TimeZone as SchemaTimeZone,
  TimeZoneBrowser as SchemaTimeZoneBrowser,
  TimeZoneUtc as SchemaTimeZoneUtc,
  defaultTimeZone,
} from '@grafana/schema';

import { dateTime, DateTime } from '../datetime/moment_wrapper';

export interface RawTimeRange {
  from: DateTime | string;
  to: DateTime | string;
}

export interface TimeRange {
  from: DateTime;
  to: DateTime;
  raw: RawTimeRange;
}

/**
 * Type to describe relative time to now in seconds.
 * @internal
 */
export interface RelativeTimeRange {
  from: number;
  to: number;
}

export interface AbsoluteTimeRange {
  from: number;
  to: number;
}

export interface IntervalValues {
  interval: string; // 10s,5m
  intervalMs: number;
}

export interface TimeOption {
  from: string;
  to: string;
  display: string;
  invalid?: boolean;
  section?: number;
}

/** @deprecated use TimeZone from schema  */
export type TimeZone = SchemaTimeZone;

/** @deprecated use TimeZoneBrowser from schema  */
export type TimeZoneBrowser = SchemaTimeZoneBrowser;

/** @deprecated use TimeZoneUtc from schema  */
export type TimeZoneUtc = SchemaTimeZoneUtc;

/** @deprecated use defaultTimeZone from schema  */
export const DefaultTimeZone = defaultTimeZone;

export interface TimeOptions {
  [key: string]: TimeOption[];
}

export type TimeFragment = string | DateTime;

export const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export function getDefaultTimeRange(): TimeRange {
  const now = dateTime();

  return {
    from: dateTime(now).subtract(6, 'hour'),
    to: now,
    raw: { from: 'now-6h', to: 'now' },
  };
}

/**
 * Returns the default relative time range.
 *
 * @public
 */
export function getDefaultRelativeTimeRange(): RelativeTimeRange {
  return {
    from: 600,
    to: 0,
  };
}

/**
 * Simple helper to quickly create a TimeRange object either from string representations of a dateTime or directly
 * DateTime objects.
 */
export function makeTimeRange(from: DateTime | string, to: DateTime | string): TimeRange {
  const fromDateTime = typeof from === 'string' ? dateTime(from) : from;
  const toDateTime = typeof to === 'string' ? dateTime(to) : to;
  return {
    from: fromDateTime,
    to: toDateTime,
    raw: {
      from: fromDateTime,
      to: toDateTime,
    },
  };
}
