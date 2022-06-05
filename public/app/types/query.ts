import { DataQuery, DataSourceRef } from '@grafana/data';

export interface QueryGroupOptions {
  queries: DataQuery[];
  dataSource: QueryGroupDataSource;
  maxDataPoints?: number | string /* must be 'x%' */ | null /* auto */;
  minInterval?: string | null;
  cacheTimeout?: string | null;
  timeRange?: {
    from?: string | null;
    shift?: string | null;
    hide?: boolean;
  };
}

export interface QueryGroupDataSource extends DataSourceRef {
  name?: string | null;
  default?: boolean;
}
