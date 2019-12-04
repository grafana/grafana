import { DataQuery } from '@grafana/data';

export interface MssqlQueryForInterpolation extends DataQuery {
  alias?: any;
  format?: any;
  rawSql?: any;
  refId: any;
  hide?: any;
}
