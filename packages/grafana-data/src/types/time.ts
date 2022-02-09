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

export type TimeZoneUtc = 'utc';
export type TimeZoneBrowser = 'browser';
export type TimeZone = TimeZoneBrowser | TimeZoneUtc | string;

export const DefaultTimeZone: TimeZone = 'browser';

export interface TimeOption {
  from: string;
  to: string;
  display: string;
}

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
 * Returns the default realtive time range.
 *
 * @public
 */
export function getDefaultRelativeTimeRange(): RelativeTimeRange {
  return {
    from: 600,
    to: 0,
  };
}
