import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface PostgresQueryForInterpolation {
  alias?: any;
  format?: any;
  rawSql?: any;
  refId: any;
  hide?: any;
}

export interface PostgresOptions extends DataSourceJsonData {
  timeInterval: string;
}

export type ResultFormat = 'time_series' | 'table';

export interface PostgresQuery extends DataQuery {
  alias?: string;
  format?: ResultFormat;
  rawSql?: any;
}
