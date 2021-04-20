import { MetricFindValue, DataQuery, DataSourceJsonData } from '@grafana/data';

export interface MySqlQueryForInterpolation {
  alias?: any;
  format?: any;
  rawSql?: any;
  refId: any;
  hide?: any;
}

export interface MySqlMetricFindValue extends MetricFindValue {
  value?: string;
}

export interface MySqlOptions extends DataSourceJsonData {
  timeInterval: string;
}

export type ResultFormat = 'time_series' | 'table';

export interface MySqlQuery extends DataQuery {
  alias?: string;
  format?: ResultFormat;
  rawSql?: any;
}
