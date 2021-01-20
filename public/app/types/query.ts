import { DataQuery } from '@grafana/data';

export interface QueryGroupOptions {
  queries: DataQuery[];
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

interface QueryGroupDataSource {
  name?: string | null;
  uid?: string;
  default?: boolean;
}
