import { config } from '@grafana/runtime';

import {
  AzureAuthType,
  AzureCloud,
  AzureCredentials,
  AzureDataSourceInstanceSettings,
  AzureDataSourceSettings,
  ConcealedSecret,
} from './types';

const concealed: ConcealedSecret = Symbol('Concealed client secret');

export function getAuthType(options: AzureDataSourceSettings | AzureDataSourceInstanceSettings): AzureAuthType {
  if (!options.jsonData.azureAuthType) {
    // If authentication type isn't explicitly specified and datasource has client credentials,
    // then this is existing datasource which is configured for app registration (client secret)
    if (options.jsonData.tenantId && options.jsonData.clientId) {
      return 'clientsecret';
    }

    // For newly created datasource with no configuration, managed identity is the default authentication type
    // if they are enabled in Grafana config
    return config.azure.managedIdentityEnabled ? 'msi' : 'clientsecret';
  }

  return options.jsonData.azureAuthType;
}

function getDefaultAzureCloud(): string {
  switch (config.azure.cloud) {
    case AzureCloud.Public:
    case AzureCloud.None:
    case undefined:
      return 'azuremonitor';
    case AzureCloud.China:
      return 'chinaazuremonitor';
    case AzureCloud.USGovernment:
      return 'govazuremonitor';
    default:
      throw new Error(`The cloud '${config.azure.cloud}' not supported.`);
  }
}

export function getAzurePortalUrl(azureCloud: string): string {
  switch (azureCloud) {
    case 'azuremonitor':
      return 'https://portal.azure.com';
    case 'chinaazuremonitor':
      return 'https://portal.azure.cn';
    case 'govazuremonitor':
      return 'https://portal.azure.us';
    default:
      throw new Error('The cloud not supported.');
  }
}

export function getAzureCloud(options: AzureDataSourceSettings | AzureDataSourceInstanceSettings): string {
  const authType = getAuthType(options);
  switch (authType) {
    case 'msi':
      // In case of managed identity, the cloud is always same as where Grafana is hosted
      return getDefaultAzureCloud();
    case 'clientsecret':
      return options.jsonData.cloudName || getDefaultAzureCloud();
  }
}

function getSecret(options: AzureDataSourceSettings): undefined | string | ConcealedSecret {
  if (options.secureJsonFields.clientSecret) {
    // The secret is concealed on server
    return concealed;
  } else {
    const secret = options.secureJsonData?.clientSecret;
    return typeof secret === 'string' && secret.length > 0 ? secret : undefined;
  }
}

export function isCredentialsComplete(credentials: AzureCredentials): boolean {
  switch (credentials.authType) {
    case 'msi':
      return true;
    case 'clientsecret':
      return !!(credentials.azureCloud && credentials.tenantId && credentials.clientId && credentials.clientSecret);
  }
}

export function getCredentials(options: AzureDataSourceSettings): AzureCredentials {
  const authType = getAuthType(options);
  switch (authType) {
    case 'msi':
      if (config.azure.managedIdentityEnabled) {
        return {
          authType: 'msi',
        };
      } else {
        // If authentication type is managed identity but managed identities were disabled in Grafana config,
        // then we should fallback to an empty app registration (client secret) configuration
        return {
          authType: 'clientsecret',
          azureCloud: getDefaultAzureCloud(),
        };
      }
    case 'clientsecret':
      return {
        authType: 'clientsecret',
        azureCloud: options.jsonData.cloudName || getDefaultAzureCloud(),
        tenantId: options.jsonData.tenantId,
        clientId: options.jsonData.clientId,
        clientSecret: getSecret(options),
      };
  }
}

export function updateCredentials(
  options: AzureDataSourceSettings,
  credentials: AzureCredentials
): AzureDataSourceSettings {
  switch (credentials.authType) {
    case 'msi':
      if (!config.azure.managedIdentityEnabled) {
        throw new Error('Managed Identity authentication is not enabled in Grafana config.');
      }

      options = {
        ...options,
        jsonData: {
          ...options.jsonData,
          azureAuthType: 'msi',
        },
      };

      return options;

    case 'clientsecret':
      options = {
        ...options,
        jsonData: {
          ...options.jsonData,
          azureAuthType: 'clientsecret',
          cloudName: credentials.azureCloud || getDefaultAzureCloud(),
          tenantId: credentials.tenantId,
          clientId: credentials.clientId,
        },
        secureJsonData: {
          ...options.secureJsonData,
          clientSecret: typeof credentials.clientSecret === 'string' ? credentials.clientSecret : undefined,
        },
        secureJsonFields: {
          ...options.secureJsonFields,
          clientSecret: typeof credentials.clientSecret === 'symbol',
        },
      };

      return options;
  }
}
