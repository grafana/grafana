import { SQLOptions } from 'app/features/plugins/sql/types';

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
export interface PostgresOptions extends SQLOptions {
  tlsConfigurationMethod?: PostgresTLSMethods;
  sslmode?: PostgresTLSModes;
  sslRootCertFile?: string;
  sslCertFile?: string;
  sslKeyFile?: string;
  postgresVersion?: number;
  timescaledb?: boolean;
}

export interface SecureJsonData {
  password: string;
}
