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
