import {
  AzureCredentials,
  getDatasourceCredentials,
  getDefaultAzureCloud,
  getClientSecret,
  resolveLegacyCloudName,
  updateDatasourceCredentials,
} from '@grafana/azure-sdk';
import { config } from '@grafana/runtime';

import { AzureMonitorDataSourceInstanceSettings, AzureMonitorDataSourceSettings } from './types';

export function getCredentials(
  options: AzureMonitorDataSourceSettings | AzureMonitorDataSourceInstanceSettings
): AzureCredentials {
  // Try to get the credentials from the datasource settings,
  // If not found, return the legacy azure monitor credentials if they exist or fallback to default credentials
  const creds = getDatasourceCredentials(options);
  if (creds) {
    return creds;
  }

  return getLegacyCredentials(options) || getDefaultCredentials();
}

export function updateCredentials(
  options: AzureMonitorDataSourceSettings,
  credentials: AzureCredentials
): AzureMonitorDataSourceSettings {
  return updateDatasourceCredentials(options, credentials);
}

function getLegacyCredentials(
  options: AzureMonitorDataSourceSettings | AzureMonitorDataSourceInstanceSettings
): AzureCredentials | undefined {
  try {
    // If authentication type isn't explicitly specified and datasource has client credentials,
    // then this is existing datasource which is configured for app registration (client secret)
    if (
      options.jsonData.azureAuthType === 'clientsecret' ||
      (!options.jsonData.azureAuthType && options.jsonData.tenantId && options.jsonData.clientId)
    ) {
      return {
        authType: 'clientsecret',
        tenantId: options.jsonData.tenantId,
        clientId: options.jsonData.clientId,
        azureCloud: resolveLegacyCloudName(options.jsonData.cloudName) || getDefaultAzureCloud(),
        clientSecret: getClientSecret(options),
      };
    }

    // If the authentication type is not set, then no legacy credentials exist so return undefined
    if (!options.jsonData.azureAuthType) {
      return undefined;
    }

    return { authType: options.jsonData.azureAuthType };
  } catch (e) {
    if (e instanceof Error) {
      console.error('Unable to restore legacy credentials: %s', e.message);
    }
    return undefined;
  }
}

function getDefaultCredentials(): AzureCredentials {
  if (config.azure.managedIdentityEnabled) {
    return { authType: 'msi' };
  } else if (config.azure.workloadIdentityEnabled) {
    return { authType: 'workloadidentity' };
  } else {
    return { authType: 'clientsecret', azureCloud: getDefaultAzureCloud() };
  }
}
