import { DateTime } from '../datetime/moment_wrapper';

export interface RawTimeRange {
  from: DateTime | string;
  to: DateTime | string;
}

export interface TimeRange {
  from: DateTime;
  to: DateTime;
  raw: RawTimeRange;
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
  section: number;
}

export interface TimeOptions {
  [key: string]: TimeOption[];
}

export type TimeFragment = string | DateTime;

export const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';

export const DefaultTimeRange: TimeRange = {
  from: {} as DateTime,
  to: {} as DateTime,
  raw: { from: '6h', to: 'now' },
};
