import { DataSourceSettings } from '@grafana/data';
import { GrafanaBootConfig } from '@grafana/runtime';

import {
  AzureCloud,
  AzureCredentialsType,
  ConcealedSecretType,
  AzureAuthSecureJSONDataType,
  AzureAuthJSONDataType,
  AzureAuthType,
} from '../types';

export const getDefaultCredentials = (managedIdentityEnabled: boolean, cloud: string): AzureCredentialsType => {
  if (managedIdentityEnabled) {
    return { authType: AzureAuthType.MSI };
  } else {
    return { authType: AzureAuthType.CLIENT_SECRET, azureCloud: cloud };
  }
};

export const getSecret = (
  storedServerSide: boolean,
  secret: string | symbol | undefined
): undefined | string | ConcealedSecretType => {
  const concealedSecret: ConcealedSecretType = Symbol('Concealed client secret');
  if (storedServerSide) {
    // The secret is concealed server side, so return the symbol
    return concealedSecret;
  } else {
    return typeof secret === 'string' && secret.length > 0 ? secret : undefined;
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
  const passwordStoredServerSide = dsSettings.secureJsonFields?.password;
  const password = dsSettings.secureJsonData?.password;

  // BootConfig data
  const managedIdentityEnabled = !!bootConfig.azure?.managedIdentityEnabled;
  const cloud = bootConfig.azure?.cloud || AzureCloud.Public;

  // If no credentials saved, then return empty credentials
  // of type based on whether the managed identity enabled
  if (!credentials) {
    return getDefaultCredentials(managedIdentityEnabled, cloud);
  }

  switch (credentials.authType) {
    case AzureAuthType.MSI:
      if (managedIdentityEnabled) {
        return {
          authType: AzureAuthType.MSI,
        };
      } else {
        // If authentication type is managed identity but managed identities were disabled in Grafana config,
        // then we should fallback to an empty app registration (client secret) configuration
        return {
          authType: AzureAuthType.CLIENT_SECRET,
          azureCloud: cloud,
        };
      }
    case AzureAuthType.CLIENT_SECRET:
      return {
        authType: AzureAuthType.CLIENT_SECRET,
        azureCloud: credentials.azureCloud || cloud,
        tenantId: credentials.tenantId,
        clientId: credentials.clientId,
        clientSecret: getSecret(clientSecretStoredServerSide, clientSecret),
      };
    case AzureAuthType.AD_PASSWORD:
      return {
        authType: AzureAuthType.AD_PASSWORD,
        userId: credentials.userId,
        clientId: credentials.clientId,
        password: getSecret(passwordStoredServerSide, password),
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
    case AzureAuthType.MSI:
      if (!managedIdentityEnabled) {
        throw new Error('Managed Identity authentication is not enabled in Grafana config.');
      }

      dsSettings = {
        ...dsSettings,
        jsonData: {
          ...dsSettings.jsonData,
          azureCredentials: {
            authType: AzureAuthType.MSI,
          },
        },
      };

      return dsSettings;

    case AzureAuthType.CLIENT_SECRET:
      dsSettings = {
        ...dsSettings,
        jsonData: {
          ...dsSettings.jsonData,
          azureCredentials: {
            authType: AzureAuthType.CLIENT_SECRET,
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

    case AzureAuthType.AD_PASSWORD:
      return {
        ...dsSettings,
        jsonData: {
          ...dsSettings.jsonData,
          azureCredentials: {
            authType: AzureAuthType.AD_PASSWORD,
            userId: credentials.userId,
            clientId: credentials.clientId,
          },
        },
        secureJsonData: {
          ...dsSettings.secureJsonData,
          password:
            typeof credentials.password === 'string' && credentials.password.length > 0
              ? credentials.password
              : undefined,
        },
        secureJsonFields: {
          ...dsSettings.secureJsonFields,
          password: typeof credentials.password === 'symbol',
        },
      };
  }
};
