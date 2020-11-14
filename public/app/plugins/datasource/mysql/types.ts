import { MetricFindValue } from '@grafana/data';

export interface MysqlQueryForInterpolation {
  alias?: any;
  format?: any;
  rawSql?: any;
  refId?: any;
  hide?: any;
}

export interface MysqlMetricFindValue extends MetricFindValue {
  value?: string;
}
