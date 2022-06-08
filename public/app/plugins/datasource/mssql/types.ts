import { DataQuery, DataSourceJsonData } from '@grafana/data';
import { SQLConnectionLimits } from 'app/features/plugins/sql/components/configuration/types';

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

export enum MSSQLAuthenticationType {
  sqlAuth = 'SQL Server Authentication',
  windowsAuth = 'Windows Authentication',
}

export enum MSSQLEncryptOptions {
  disable = 'disable',
  false = 'false',
  true = 'true',
}
export interface MssqlOptions extends DataSourceJsonData, SQLConnectionLimits {
  authenticationType: MSSQLAuthenticationType;
  encrypt: MSSQLEncryptOptions;
  serverName: string;
  sslRootCertFile: string;
  tlsSkipVerify: boolean;
  url: string;
  database: string;
  timeInterval: string;
  user: string;
}
