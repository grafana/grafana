import { DataQuery, DataSourceJsonData } from '@grafana/data';
import { SQLConnectionLimits } from 'app/features/plugins/sql/types';

export enum PostgresTLSModes {
  disable = 'disable',
  require = 'require',
  verifyCA = 'verify-ca',
  verifyFull = 'verify-full',
}

export enum PostgresTLSMethods {
  filePath = 'file-path',
  fileContent = 'file-content',
}
export interface PostgresOptions extends DataSourceJsonData, SQLConnectionLimits {
  url: string;
  timeInterval: string;
  database: string;
  user: string;
  tlsConfigurationMethod: PostgresTLSMethods;
  sslmode: PostgresTLSModes;
  sslRootCertFile: string;
  sslCertFile: string;
  sslKeyFile: string;
  postgresVersion: number;
  timescaledb: boolean;
}

export interface SecureJsonData {
  password: string;
}

export type ResultFormat = 'time_series' | 'table';
export interface PostgresQuery extends DataQuery {
  alias?: string;
  format?: ResultFormat;
  rawSql?: any;
}

export interface PostgresQueryForInterpolation {
  alias?: any;
  format?: any;
  rawSql?: any;
  refId: any;
  hide?: any;
}
