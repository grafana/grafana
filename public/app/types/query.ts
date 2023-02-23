import { DataQuery, DataSourceRef } from '@grafana/data';

export interface QueryGroupOptions {
  queries: DataQuery[];
  dataSource: QueryGroupDataSource;
  savedQueryUid?: string | null;
  maxDataPoints?: number | null;
  minInterval?: string | null;
  cacheTimeout?: string | null;
  queryCachingTTL?: number | null;
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
