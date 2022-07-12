import { DataSourceJsonData } from '@grafana/data';
import { SQLQuery } from 'app/features/plugins/sql/types';
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

export interface MySQLQuery extends SQLQuery {}
