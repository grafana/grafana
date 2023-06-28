import { DataSourceSettings } from '@grafana/data';
import { GrafanaBootConfig } from '@grafana/runtime';

import { AzureAuthSecureJSONDataType, AzureAuthJSONDataType } from '../types';

export const configWithManagedIdentityEnabled: GrafanaBootConfig = {
  azure: { managedIdentityEnabled: true, userIdentityEnabled: false },
  // @ts-ignore
} as unknown as GrafanaBootConfig;

export const configWithManagedIdentityDisabled: GrafanaBootConfig = {
  azure: { managedIdentityEnabled: false, userIdentityEnabled: false, cloud: 'AzureCloud' },
  // @ts-ignore
} as unknown as GrafanaBootConfig;

export const dataSourceSettingsWithMsiCredentials: DataSourceSettings<
  AzureAuthJSONDataType,
  AzureAuthSecureJSONDataType
> = {
  jsonData: { azureCredentials: { authType: 'msi' } },
  // @ts-ignore
} as unknown as DataSourceSettings<AzureAuthJSONDataType, AzureAuthSecureJSONDataType>;

const basicJSONData = {
  jsonData: {
    azureCredentials: {
      authType: 'clientsecret',
      tenantId: 'XXXX-tenant-id-XXXX',
      clientId: 'XXXX-client-id-XXXX',
    },
  },
};

// Will return symbol as the secret is concealed
export const dataSourceSettingsWithClientSecretOnServer: DataSourceSettings<
  AzureAuthJSONDataType,
  AzureAuthSecureJSONDataType
  // @ts-ignore
> = { ...basicJSONData, secureJsonFields: { azureClientSecret: true } } as unknown as DataSourceSettings<
  AzureAuthJSONDataType,
  AzureAuthSecureJSONDataType
>;

// Will return the secret as a string from the secureJsonData
export const dataSourceSettingsWithClientSecretInSecureJSONData: DataSourceSettings<
  AzureAuthJSONDataType,
  AzureAuthSecureJSONDataType
> = {
  ...basicJSONData,
  secureJsonData: { azureClientSecret: 'XXXX-super-secret-secret-XXXX' },
  // @ts-ignore
} as unknown as DataSourceSettings<AzureAuthJSONDataType, AzureAuthSecureJSONDataType>;
