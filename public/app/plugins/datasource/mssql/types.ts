import { DataSourceJsonData } from '@grafana/data';
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

export enum AzureCloud {
  Public = 'AzureCloud',
  None = '',
}

export type ConcealedSecretType = symbol;

export enum AzureAuthType {
  MSI = 'msi',
  CLIENT_SECRET = 'clientsecret',
  AD_PASSWORD = 'ad-password',
}

export interface AzureCredentialsType {
  authType: AzureAuthType;
  azureCloud?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string | ConcealedSecretType;
  userId?: string;
  password?: string | ConcealedSecretType;
}

export interface MssqlOptions extends SQLOptions {
  authenticationType?: MSSQLAuthenticationType;
  encrypt?: MSSQLEncryptOptions;
  sslRootCertFile?: string;
  serverName?: string;
  connectionTimeout?: number;
  azureCredentials?: AzureCredentialsType;
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

export type AzureAuthJSONDataType = DataSourceJsonData & {
  azureCredentials: AzureCredentialsType;
};

export type AzureAuthSecureJSONDataType = {
  azureClientSecret: undefined | string | ConcealedSecretType;
  password: undefined | string | ConcealedSecretType;
};

export type AzureAuthConfigType = {
  azureAuthIsSupported: boolean;
  azureAuthSettingsUI: (props: HttpSettingsBaseProps) => JSX.Element;
};
