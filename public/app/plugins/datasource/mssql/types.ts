import { SQLOptions } from 'app/features/plugins/sql/types';

export enum MSSQLAuthenticationType {
  sqlAuth = 'SQL Server Authentication',
  windowsAuth = 'Windows Authentication',
  azureAuth = 'Azure AD Authentication',
}

export enum MSSQLEncryptOptions {
  disable = 'disable',
  false = 'false',
  true = 'true',
}
export interface MssqlOptions extends SQLOptions {
  authenticationType?: MSSQLAuthenticationType;
  encrypt?: MSSQLEncryptOptions;
  sslRootCertFile?: string;
  serverName?: string;
  connectionTimeout?: number;
  azureCredentials?: any;
}
