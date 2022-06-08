import { DataQuery, DataSourceJsonData } from '@grafana/data';
import { SQLConnectionLimits } from 'app/features/plugins/sql/components/configuration/types';
export interface MysqlQueryForInterpolation {
  alias?: any;
  format?: any;
  rawSql?: any;
  refId: any;
  hide?: any;
}

export interface MySQLOptions extends DataSourceJsonData, SQLConnectionLimits {
  tlsAuth: boolean | undefined;
  tlsAuthWithCACert: boolean | undefined;
  timezone: string | number | readonly string[] | undefined;
  tlsSkipVerify: any;
  user: string;
  database: string;
  url: string;
  timeInterval: string;
}

export type ResultFormat = 'time_series' | 'table';

export interface MySQLQuery extends DataQuery {
  alias?: string;
  format?: ResultFormat;
  rawSql?: any; // eslint-disable-line
}
