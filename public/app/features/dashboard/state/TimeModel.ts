import { TimeRange, TimeZone } from '@grafana/data';

export interface TimeModel {
  time: any;
  fiscalYearStartMonth?: number;
  refresh: any;
  timepicker: any;
  getTimezone(): TimeZone;
  timeRangeUpdated(timeRange: TimeRange): void;
}
