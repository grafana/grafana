import { type RawTimeRange, type TimeRange, type TimeZone } from '@grafana/data';

export interface TimeModel {
  time: RawTimeRange;
  fiscalYearStartMonth?: number;
  refresh?: string;
  timepicker: any;
  getTimezone(): TimeZone;
  timeRangeUpdated(timeRange: TimeRange): void;
}
