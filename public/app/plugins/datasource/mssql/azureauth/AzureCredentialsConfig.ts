import { DataSourceSettings, DataSourceJsonData } from '@grafana/data';
import { GrafanaBootConfig } from '@grafana/runtime';

import {
  AzureCloud,
  AzureCredentialsType,
  ConcealedSecret,
  AzureAuthSecureJSONDataType,
  AzureAuthJSONDataType,
} from '../types';

const concealed: ConcealedSecret = Symbol('Concealed client secret');

export const getDefaultAzureCloud = (bootConfig: GrafanaBootConfig): string => {
  return bootConfig.azure?.cloud || AzureCloud.Public;
};

export const getDefaultCredentials = (bootConfig: GrafanaBootConfig): AzureCredentialsType => {
  if (bootConfig.azure.managedIdentityEnabled) {
    return { authType: 'msi' };
  } else {
    return { authType: 'clientsecret', azureCloud: getDefaultAzureCloud(bootConfig) };
  }
};

export const getSecret = (
  dsSettings: DataSourceSettings<DataSourceJsonData, AzureAuthSecureJSONDataType>,
  concealedSecret: symbol
): undefined | string | ConcealedSecret => {
  if (dsSettings.secureJsonFields.azureClientSecret) {
    // The secret is concealed on server
    return concealedSecret;
  } else {
    const secret = dsSettings.secureJsonData?.azureClientSecret;
    return typeof secret === 'string' && secret.length > 0 ? secret : undefined;
  }
};

export const getCredentials = (
  dsSettings: DataSourceSettings<AzureAuthJSONDataType, AzureAuthSecureJSONDataType>,
  bootConfig: GrafanaBootConfig
): AzureCredentialsType => {
  const credentials = dsSettings.jsonData?.azureCredentials;

  // If no credentials saved, then return empty credentials
  // of type based on whether the managed identity enabled
  if (!credentials) {
    return getDefaultCredentials(bootConfig);
  }

  switch (credentials.authType) {
    case 'msi':
      if (bootConfig.azure.managedIdentityEnabled) {
        return {
          authType: 'msi',
        };
      } else {
        // If authentication type is managed identity but managed identities were disabled in Grafana config,
        // then we should fallback to an empty app registration (client secret) configuration
        return {
          authType: 'clientsecret',
          azureCloud: getDefaultAzureCloud(bootConfig),
        };
      }
    case 'clientsecret':
      return {
        authType: 'clientsecret',
        azureCloud: credentials.azureCloud || getDefaultAzureCloud(bootConfig),
        tenantId: credentials.tenantId,
        clientId: credentials.clientId,
        clientSecret: getSecret(dsSettings, concealed),
      };
  }
};

export const updateCredentials = (
  dsSettings: DataSourceSettings<AzureAuthJSONDataType>,
  bootConfig: GrafanaBootConfig,
  credentials: AzureCredentialsType
): DataSourceSettings<AzureAuthJSONDataType> => {
  switch (credentials.authType) {
    case 'msi':
      if (!bootConfig.azure.managedIdentityEnabled) {
        throw new Error('Managed Identity authentication is not enabled in Grafana config.');
      }

      dsSettings = {
        ...dsSettings,
        jsonData: {
          ...dsSettings.jsonData,
          azureCredentials: {
            authType: 'msi',
          },
        },
      };

      return dsSettings;

    case 'clientsecret':
      dsSettings = {
        ...dsSettings,
        jsonData: {
          ...dsSettings.jsonData,
          azureCredentials: {
            authType: 'clientsecret',
            azureCloud: credentials.azureCloud || getDefaultAzureCloud(bootConfig),
            tenantId: credentials.tenantId,
            clientId: credentials.clientId,
          },
        },
        secureJsonData: {
          ...dsSettings.secureJsonData,
          azureClientSecret:
            typeof credentials.clientSecret === 'string' && credentials.clientSecret.length > 0
              ? credentials.clientSecret
              : undefined,
        },
        secureJsonFields: {
          ...dsSettings.secureJsonFields,
          azureClientSecret: typeof credentials.clientSecret === 'symbol',
        },
      };

      return dsSettings;
  }
};
