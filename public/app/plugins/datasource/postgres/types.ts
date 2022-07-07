import { DataQuery, DataSourceJsonData } from '@grafana/data';
import { SQLConnectionLimits } from 'app/features/plugins/sql/components/configuration/types';

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

export type ResultFormat = 'time_series' | 'table';
export interface PostgresQuery extends DataQuery {
  alias?: string;
  format?: ResultFormat;
  rawSql?: any; //eslint-disable-line
}

export interface PostgresQueryForInterpolation {
  alias?: any; //eslint-disable-line
  format?: any; //eslint-disable-line
  rawSql?: any; //eslint-disable-line
  refId: any; //eslint-disable-line
  hide?: any; //eslint-disable-line
}
