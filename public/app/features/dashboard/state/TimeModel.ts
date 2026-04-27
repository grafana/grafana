import type { TimeRange, TimeZone } from '@grafana/data/types';

export interface TimeModel {
  time: any;
  fiscalYearStartMonth?: number;
  refresh?: string;
  timepicker: any;
  getTimezone(): TimeZone;
  timeRangeUpdated(timeRange: TimeRange): void;
}
