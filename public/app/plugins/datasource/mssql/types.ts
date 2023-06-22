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

export type ConcealedSecret = symbol;

export type AzureAuthType = 'msi' | 'clientsecret';

interface AzureCredentialsBaseType {
  authType: AzureAuthType;
  defaultSubscriptionId?: string;
}

interface AzureManagedIdentityCredentialsType extends AzureCredentialsBaseType {
  authType: 'msi';
}

interface AzureClientSecretCredentialsType extends AzureCredentialsBaseType {
  authType: 'clientsecret';
  azureCloud?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string | ConcealedSecret;
}

export type AzureCredentialsType = AzureManagedIdentityCredentialsType | AzureClientSecretCredentialsType;

export interface MssqlOptions extends SQLOptions {
  authenticationType?: MSSQLAuthenticationType;
  encrypt?: MSSQLEncryptOptions;
  sslRootCertFile?: string;
  serverName?: string;
  connectionTimeout?: number;
  azureCredentials?: any;
}

export type AzureAuthJSONDataType = DataSourceJsonData & {
  azureCredentials: AzureCredentialsType;
};

export type AzureAuthSecureJSONDataType = {
  azureClientSecret: undefined | string | ConcealedSecret;
};

export type AzureAuthConfigType = {
  azureAuthIsSupported: boolean;
  azureAuthSettingsUI: (props: HttpSettingsBaseProps) => JSX.Element;
};
