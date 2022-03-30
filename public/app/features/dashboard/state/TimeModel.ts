import { TimeRange, TimeZone } from '@grafana/data';

export interface TimeModel {
  time: any;
  fiscalYearStartMonth?: number;
  refresh: any;
  timepicker: TimePickerOptions;
  getTimezone(): TimeZone;
  timeRangeUpdated(timeRange: TimeRange): void;
}

export interface TimePickerOptions {
  maxTimeRange?: string;
  refresh_intervals?: string[];
  hidden?: boolean;
  nowDelay?: string;
}
