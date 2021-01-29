import { DataQuery } from '@grafana/data';
import { ExpressionQuery } from '../features/expressions/types';

export interface QueryGroupOptions {
  queries: Array<DataQuery | ExpressionQuery>;
  dataSource: QueryGroupDataSource;
  maxDataPoints?: number | null;
  minInterval?: string | null;
  cacheTimeout?: string | null;
  timeRange?: {
    from?: string | null;
    shift?: string | null;
    hide?: boolean;
  };
}

export interface QueryGroupDataSource {
  name?: string | null;
  uid?: string;
  default?: boolean;
}
