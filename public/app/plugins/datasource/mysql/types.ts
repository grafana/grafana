import { DataSourceJsonData } from '@grafana/data';

import { SQLQuery } from '../../../features/plugins/sql/types';
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

export interface MySQLQuery extends SQLQuery {}
