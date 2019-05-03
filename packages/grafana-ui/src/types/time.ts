import { DateTimeType } from 'app/core/moment_wrapper';

export interface RawTimeRange {
  from: DateTimeType | string;
  to: DateTimeType | string;
}

export interface TimeRange {
  from: DateTimeType;
  to: DateTimeType;
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

export type TimeFragment = string | DateTimeType;

export const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
