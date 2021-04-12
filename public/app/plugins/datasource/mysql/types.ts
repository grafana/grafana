import { MetricFindValue, DataQuery, DataSourceJsonData } from '@grafana/data';
export interface MysqlQueryForInterpolation {
  alias?: any;
  format?: any;
  rawSql?: any;
  refId: any;
  hide?: any;
}

export interface MysqlMetricFindValue extends MetricFindValue {
  value?: string;
}

export interface MySQLOptions extends DataSourceJsonData {
  timeInterval: string;
}

export type ResultFormat = 'time_series' | 'table';

export interface MySQLQuery extends DataQuery {
  policy?: string;
  measurement?: string;
  resultFormat?: ResultFormat;
  orderByTime?: string;
  limit?: string;
  slimit?: string;
  tz?: string;
  fill?: string;
  query?: string;
  alias?: string;
  format?: any;
  rawSql?: any;
}
