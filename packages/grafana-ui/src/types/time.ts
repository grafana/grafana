import { DateTime } from '../utils/moment_wrapper';

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

export interface TimeZone {
  raw: string;
  isUtc: boolean;
}

export const parseTimeZone = (raw: string): TimeZone => {
  return {
    raw,
    isUtc: raw === 'utc',
  };
};

export const DefaultTimeZone = parseTimeZone('browser');

export interface TimeOption {
  from: string;
  to: string;
  display: string;
  section: number;
  active: boolean;
}

export interface TimeOptions {
  [key: string]: TimeOption[];
}

export type TimeFragment = string | DateTime;

export const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
