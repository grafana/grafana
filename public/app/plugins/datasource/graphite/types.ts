import { DataQuery } from '@grafana/ui';

export interface GraphiteQuery extends DataQuery {
  target?: string;
}
