import { DataSourceSettings } from '@grafana/data';
import { GrafanaBootConfig } from '@grafana/runtime';

import { AzureAuthSecureJSONDataType, AzureAuthJSONDataType, AzureAuthType } from '../types';

export const configWithManagedIdentityEnabled: Partial<GrafanaBootConfig> = {
  azure: { managedIdentityEnabled: true, workloadIdentityEnabled: false, userIdentityEnabled: false },
};

export const configWithManagedIdentityDisabled: Partial<GrafanaBootConfig> = {
  azure: {
    managedIdentityEnabled: false,
    workloadIdentityEnabled: false,
    userIdentityEnabled: false,
    cloud: 'AzureCloud',
  },
};

export const dataSourceSettingsWithMsiCredentials: Partial<
  DataSourceSettings<AzureAuthJSONDataType, AzureAuthSecureJSONDataType>
> = {
  jsonData: { azureCredentials: { authType: AzureAuthType.MSI } },
};

const basicJSONData = {
  jsonData: {
    azureCredentials: {
      authType: AzureAuthType.CLIENT_SECRET,
      tenantId: 'XXXX-tenant-id-XXXX',
      clientId: 'XXXX-client-id-XXXX',
    },
  },
};

// Will return symbol as the secret is concealed
export const dataSourceSettingsWithClientSecretOnServer: Partial<
  DataSourceSettings<AzureAuthJSONDataType, AzureAuthSecureJSONDataType>
> = { ...basicJSONData, secureJsonFields: { azureClientSecret: true } };

// Will return the secret as a string from the secureJsonData
export const dataSourceSettingsWithClientSecretInSecureJSONData: Partial<
  DataSourceSettings<AzureAuthJSONDataType, AzureAuthSecureJSONDataType>
> = {
  ...basicJSONData,
  secureJsonData: { azureClientSecret: 'XXXX-super-secret-secret-XXXX' },
};
