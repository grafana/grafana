import { AzureDataSourceSettings } from '@grafana/azure-sdk';
import { GrafanaBootConfig } from '@grafana/runtime';

export const configWithManagedIdentityEnabled: Partial<GrafanaBootConfig> = {
  azure: {
    managedIdentityEnabled: true,
    workloadIdentityEnabled: false,
    userIdentityEnabled: false,
    userIdentityFallbackCredentialsEnabled: false,
    azureEntraPasswordCredentialsEnabled: false,
  },
};

export const configWithManagedIdentityDisabled: Partial<GrafanaBootConfig> = {
  azure: {
    managedIdentityEnabled: false,
    workloadIdentityEnabled: false,
    userIdentityEnabled: false,
    cloud: 'AzureCloud',
    userIdentityFallbackCredentialsEnabled: false,
    azureEntraPasswordCredentialsEnabled: false,
  },
};

export const dataSourceSettingsWithMsiCredentials: Partial<AzureDataSourceSettings> = {
  jsonData: { azureCredentials: { authType: 'msi' } },
};

// Will return symbol as the secret is concealed
export const dataSourceSettingsWithClientSecretOnServer: Partial<AzureDataSourceSettings> = {
  jsonData: {
    azureCredentials: { authType: 'clientsecret', clientId: 'XXXX-client-id-XXXX', tenantId: 'XXXX-tenant-id-XXXX' },
  },
  secureJsonFields: { azureClientSecret: true },
};
// Will return the secret as a string from the secureJsonData
export const dataSourceSettingsWithClientSecretInSecureJSONData: Partial<AzureDataSourceSettings> = {
  jsonData: {
    azureCredentials: { authType: 'clientsecret', clientId: 'XXXX-client-id-XXXX', tenantId: 'XXXX-tenant-id-XXXX' },
  },
  secureJsonFields: { azureClientSecret: false },
  secureJsonData: { azureClientSecret: 'XXXX-super-secret-secret-XXXX' },
};
