import { DataQuery, DataSourceJsonData } from '@grafana/data';

export interface MssqlQueryForInterpolation {
  alias?: any;
  format?: any;
  rawSql?: any;
  refId: any;
  hide?: any;
}

export type ResultFormat = 'time_series' | 'table';

export interface MssqlQuery extends DataQuery {
  alias?: string;
  format?: ResultFormat;
  rawSql?: any;
}

export interface MssqlOptions extends DataSourceJsonData {
  timeInterval: string;
}
