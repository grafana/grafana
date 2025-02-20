import {
  AzureCredentials,
  AzureDataSourceJsonData,
  AzureDataSourceSecureJsonData,
  AzureDataSourceSettings,
  getAzureClouds,
  getDatasourceCredentials,
  getDefaultAzureCloud,
  updateDatasourceCredentials,
} from '@grafana/azure-sdk';
import { DataSourceSettings, SelectableValue } from '@grafana/data';
import { PromOptions } from '@grafana/prometheus';
import { config } from '@grafana/runtime';

export function getAzureCloudOptions(): Array<SelectableValue<string>> {
  const cloudInfo = getAzureClouds();

  return cloudInfo.map((cloud) => ({
    value: cloud.name,
    label: cloud.displayName,
  }));
}

export function getDefaultCredentials(): AzureCredentials {
  if (config.azure.managedIdentityEnabled) {
    return { authType: 'msi' };
  } else {
    return { authType: 'clientsecret', azureCloud: getDefaultAzureCloud() };
  }
}

export function getCredentials(options: AzureDataSourceSettings): AzureCredentials {
  const credentials = getDatasourceCredentials(options);
  if (credentials) {
    return credentials;
  }

  // If no credentials saved, then return empty credentials
  // of type based on whether the managed identity enabled
  return getDefaultCredentials();
}

export function updateCredentials(
  options: AzurePromDataSourceSettings,
  credentials: AzureCredentials
): AzurePromDataSourceSettings {
  return updateDatasourceCredentials(options, credentials);
}

export function setDefaultCredentials(options: AzurePromDataSourceSettings): Partial<AzurePromDataSourceSettings> {
  return {
    jsonData: {
      ...options.jsonData,
      azureCredentials: getDefaultCredentials(),
    },
  };
}

export function resetCredentials(options: AzurePromDataSourceSettings): Partial<AzurePromDataSourceSettings> {
  return {
    jsonData: {
      ...options.jsonData,
      azureCredentials: undefined,
      azureEndpointResourceId: undefined,
    },
  };
}

export interface AzurePromDataSourceOptions extends PromOptions, AzureDataSourceJsonData {
  azureEndpointResourceId?: string;
}

export type AzurePromDataSourceSettings = DataSourceSettings<AzurePromDataSourceOptions, AzureDataSourceSecureJsonData>;
