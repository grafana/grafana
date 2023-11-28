import { TimeRange, TimeZone } from '@grafana/data';

export interface TimeModel {
  time: any;
  fiscalYearStartMonth?: number;
  refresh?: string | false;
  timepicker: any;
  getTimezone(): TimeZone;
  timeRangeUpdated(timeRange: TimeRange): void;
}
