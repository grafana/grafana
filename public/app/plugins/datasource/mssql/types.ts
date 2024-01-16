import { DataSourceJsonData } from '@grafana/data';
import { HttpSettingsBaseProps } from '@grafana/ui/src/components/DataSourceSettings/types';
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

export enum AzureCloud {
  Public = 'AzureCloud',
  None = '',
}

export type ConcealedSecretType = symbol;

export enum AzureAuthType {
  MSI = 'msi',
  CLIENT_SECRET = 'clientsecret',
}

export interface AzureCredentialsType {
  authType: AzureAuthType;
  azureCloud?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string | ConcealedSecretType;
}

export interface MssqlOptions extends SQLOptions {
  authenticationType?: MSSQLAuthenticationType;
  encrypt?: MSSQLEncryptOptions;
  sslRootCertFile?: string;
  serverName?: string;
  connectionTimeout?: number;
  azureCredentials?: AzureCredentialsType;
}

export interface MssqlSecureOptions {
  password?: string;
}

export type AzureAuthJSONDataType = DataSourceJsonData & {
  azureCredentials: AzureCredentialsType;
};

export type AzureAuthSecureJSONDataType = {
  azureClientSecret: undefined | string | ConcealedSecretType;
};

export type AzureAuthConfigType = {
  azureAuthIsSupported: boolean;
  azureAuthSettingsUI: (props: HttpSettingsBaseProps) => JSX.Element;
};
