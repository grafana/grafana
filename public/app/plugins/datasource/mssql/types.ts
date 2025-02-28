import { AzureCredentials } from '@grafana/azure-sdk';
import { SQLOptions } from '@grafana/sql';
import { HttpSettingsBaseProps } from '@grafana/ui/src/components/DataSourceSettings/types';

export enum MSSQLAuthenticationType {
  sqlAuth = 'SQL Server Authentication',
  windowsAuth = 'Windows Authentication',
  azureAuth = 'Azure AD Authentication',
  kerberosRaw = 'Windows AD: Username + password',
  kerberosKeytab = 'Windows AD: Keytab',
  kerberosCredentialCache = 'Windows AD: Credential cache',
  kerberosCredentialCacheLookupFile = 'Windows AD: Credential cache file',
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
  azureCredentials?: AzureCredentials;
  keytabFilePath?: string;
  credentialCache?: string;
  credentialCacheLookupFile?: string;
  configFilePath?: string;
  UDPConnectionLimit?: number;
  enableDNSLookupKDC?: string;
}

export interface MssqlSecureOptions {
  password?: string;
}

export type AzureAuthConfigType = {
  azureAuthIsSupported: boolean;
  azureAuthSettingsUI: (props: HttpSettingsBaseProps) => JSX.Element;
};
