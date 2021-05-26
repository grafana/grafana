import { DataQuery, DataSourceJsonData } from '@grafana/data';
export interface MysqlQueryForInterpolation {
  alias?: any;
  format?: any;
  rawSql?: any;
  refId: any;
  hide?: any;
}

export interface MySQLOptions extends DataSourceJsonData {
  timeInterval: string;
}

export type ResultFormat = 'time_series' | 'table';

export interface MySQLQuery extends DataQuery {
  alias?: string;
  format?: ResultFormat;
  rawSql?: any;
}
