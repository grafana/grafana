import { DataQuery, TimeRange } from '@grafana/data';

export interface AlertingQuery extends DataQuery {
  timeRange?: TimeRange;
}
