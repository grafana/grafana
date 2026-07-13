import { type AzureDataSourceSettings } from '@grafana/azure-sdk';

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
