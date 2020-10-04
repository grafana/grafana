import { LogsSortOrder } from '@grafana/data';

export interface Options {
  showLabels: boolean;
  showTime: boolean;
  wrapLogMessage: boolean;
  sortOrder: LogsSortOrder;
}
