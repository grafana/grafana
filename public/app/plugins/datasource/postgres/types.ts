import { DataQuery } from '@grafana/data';

export interface PostgresQueryForInterpolation extends DataQuery {
  alias?: any;
  format?: any;
  rawSql?: any;
  refId: any;
  hide?: any;
}
