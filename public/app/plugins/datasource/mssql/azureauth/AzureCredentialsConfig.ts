import { DataSourceSettings } from '@grafana/data';
import { GrafanaBootConfig } from '@grafana/runtime';

import {
  AzureCloud,
  AzureCredentialsType,
  ConcealedSecretType,
  AzureAuthSecureJSONDataType,
  AzureAuthJSONDataType,
} from '../types';

export const getDefaultCredentials = (managedIdentityEnabled: boolean, cloud: string): AzureCredentialsType => {
  if (managedIdentityEnabled) {
    return { authType: 'msi' };
  } else {
    return { authType: 'clientsecret', azureCloud: cloud };
  }
};

export const getSecret = (
  clientSecretStoredServerSide: boolean,
  clientSecret: string | symbol | undefined
): undefined | string | ConcealedSecretType => {
  const concealedSecret: ConcealedSecretType = Symbol('Concealed client secret');
  if (clientSecretStoredServerSide) {
    // The secret is concealed server side, so return the symbol
    return concealedSecret;
  } else {
    return typeof clientSecret === 'string' && clientSecret.length > 0 ? clientSecret : undefined;
  }
};

export const getCredentials = (
  dsSettings: DataSourceSettings<AzureAuthJSONDataType, AzureAuthSecureJSONDataType>,
  bootConfig: GrafanaBootConfig
): AzureCredentialsType => {
  // JSON data
  const credentials = dsSettings.jsonData?.azureCredentials;

  // Secure JSON data/fields
  const clientSecretStoredServerSide = dsSettings.secureJsonFields?.azureClientSecret;
  const clientSecret = dsSettings.secureJsonData?.azureClientSecret;

  // BootConfig data
  const managedIdentityEnabled = !!bootConfig.azure?.managedIdentityEnabled;
  const cloud = bootConfig.azure?.cloud || AzureCloud.Public;

  // If no credentials saved, then return empty credentials
  // of type based on whether the managed identity enabled
  if (!credentials) {
    return getDefaultCredentials(managedIdentityEnabled, cloud);
  }

  switch (credentials.authType) {
    case 'msi':
      if (managedIdentityEnabled) {
        return {
          authType: 'msi',
        };
      } else {
        // If authentication type is managed identity but managed identities were disabled in Grafana config,
        // then we should fallback to an empty app registration (client secret) configuration
        return {
          authType: 'clientsecret',
          azureCloud: cloud,
        };
      }
    case 'clientsecret':
      return {
        authType: 'clientsecret',
        azureCloud: credentials.azureCloud || cloud,
        tenantId: credentials.tenantId,
        clientId: credentials.clientId,
        clientSecret: getSecret(clientSecretStoredServerSide, clientSecret),
      };
  }
};

export const updateCredentials = (
  dsSettings: DataSourceSettings<AzureAuthJSONDataType>,
  bootConfig: GrafanaBootConfig,
  credentials: AzureCredentialsType
): DataSourceSettings<AzureAuthJSONDataType> => {
  // BootConfig data
  const managedIdentityEnabled = !!bootConfig.azure?.managedIdentityEnabled;
  const cloud = bootConfig.azure?.cloud || AzureCloud.Public;

  switch (credentials.authType) {
    case 'msi':
      if (!managedIdentityEnabled) {
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
            azureCloud: credentials.azureCloud || cloud,
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
