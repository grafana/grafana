import { DataQuery, DataSourceJsonData } from '@grafana/data';
import { SQLConnectionLimits } from 'app/features/plugins/sql/components/configuration/types';

export interface PostgresQueryForInterpolation {
  alias?: any;
  format?: any;
  rawSql?: any;
  refId: any;
  hide?: any;
}

export interface PostgresOptions extends DataSourceJsonData, SQLConnectionLimits {
  url: string;
  timeInterval: string;
  database: string;
  user: string;
  tlsConfigurationMethod: string;
  sslmode: string;
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
  rawSql?: any;
}
