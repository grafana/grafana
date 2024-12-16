import {
  AzureCredentials,
  AzureDataSourceSettings,
  getDatasourceCredentials,
  getDefaultAzureCloud,
} from '@grafana/azure-sdk';
import { config } from '@grafana/runtime';

export const getDefaultCredentials = (): AzureCredentials => {
  if (config.azure.managedIdentityEnabled) {
    return { authType: 'msi' };
  } else {
    return { authType: 'clientsecret', azureCloud: getDefaultAzureCloud() };
  }
};

export const getCredentials = (dsSettings: AzureDataSourceSettings): AzureCredentials => {
  const credentials = getDatasourceCredentials(dsSettings);
  if (credentials) {
    return credentials;
  }

  // If no credentials saved, then return empty credentials
  // of type based on whether the managed identity enabled
  return getDefaultCredentials();
};
