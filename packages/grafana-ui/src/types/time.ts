import { Moment } from 'moment';

export interface RawTimeRange {
  from: Moment | string;
  to: Moment | string;
}

export interface TimeRange {
  from: Moment;
  to: Moment;
  raw: RawTimeRange;
}

export interface IntervalValues {
  interval: string; // 10s,5m
  intervalMs: number;
}

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

export type TimeFragment = string | Moment;

export const TIME_FORMAT = 'YYYY-MM-DD HH:mm:ss';
