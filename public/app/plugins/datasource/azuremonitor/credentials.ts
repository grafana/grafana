import { getAzureClouds } from '@grafana/azure-sdk';
import { config } from '@grafana/runtime';

import {
  AadCurrentUserCredentials,
  AzureAuthType,
  AzureClientSecretCredentials,
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

function resolveLegacyCloudName(cloudName: string | undefined): string | undefined {
  if (!cloudName) {
    // if undefined, allow the code to fallback to calling getDefaultAzureCloud() since that has the complete logic for handling an empty cloud name
    return undefined;
  }
  switch (cloudName) {
    case 'azuremonitor':
      return AzureCloud.Public;
    case 'chinaazuremonitor':
      return AzureCloud.China;
    case 'govazuremonitor':
      return AzureCloud.USGovernment;
    default:
      return cloudName;
  }
}

function getDefaultAzureCloud(): string {
  const cloudName = resolveLegacyCloudName(config.azure.cloud);

  switch (cloudName) {
    case AzureCloud.Public:
    case AzureCloud.None:
      return AzureCloud.Public;
    case AzureCloud.China:
      return AzureCloud.China;
    case AzureCloud.USGovernment:
      return AzureCloud.USGovernment;
    default:
      const cloudInfo = getAzureClouds();

      for (const cloud of cloudInfo) {
        if (cloud.name === config.azure.cloud) {
          return cloud.name;
        }
      }
      throw new Error(`The cloud '${config.azure.cloud}' is unsupported.`);
  }
}

export function getAzureCloud(options: AzureDataSourceSettings | AzureDataSourceInstanceSettings): string {
  const authType = getAuthType(options);
  switch (authType) {
    case 'msi':
    case 'workloadidentity':
      // In case of managed identity and workload identity, the cloud is always same as where Grafana is hosted
      return getDefaultAzureCloud();
    case 'clientsecret':
    case 'currentuser':
      return resolveLegacyCloudName(options.jsonData.cloudName) || getDefaultAzureCloud();
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

export function isCredentialsComplete(credentials: AzureCredentials, ignoreSecret = false): boolean {
  switch (credentials.authType) {
    case 'msi':
    case 'workloadidentity':
    case 'currentuser':
      return true;
    case 'clientsecret':
      return !!(
        credentials.azureCloud &&
        credentials.tenantId &&
        credentials.clientId &&
        // When ignoreSecret is set we consider the credentials complete without checking the secret
        !!(ignoreSecret || credentials.clientSecret)
      );
  }
}

export function instanceOfAzureCredential<T extends AzureCredentials>(
  authType: AzureAuthType,
  object?: AzureCredentials
): object is T {
  if (!object) {
    return false;
  }
  return object.authType === authType;
}

export function getCredentials(options: AzureDataSourceSettings): AzureCredentials {
  const authType = getAuthType(options);
  const credentials = options.jsonData.azureCredentials;
  switch (authType) {
    case 'msi':
    case 'workloadidentity':
      if (
        (authType === 'msi' && config.azure.managedIdentityEnabled) ||
        (authType === 'workloadidentity' && config.azure.workloadIdentityEnabled)
      ) {
        return {
          authType,
        };
      } else {
        // If authentication type is managed identity or workload identity but either method is disabled in Grafana config,
        // then we should fallback to an empty app registration (client secret) configuration
        return {
          authType: 'clientsecret',
          azureCloud: getDefaultAzureCloud(),
        };
      }
    case 'clientsecret':
      return {
        authType,
        azureCloud: resolveLegacyCloudName(options.jsonData.cloudName) || getDefaultAzureCloud(),
        tenantId: options.jsonData.tenantId,
        clientId: options.jsonData.clientId,
        clientSecret: getSecret(options),
      };
  }
  if (instanceOfAzureCredential<AadCurrentUserCredentials>(authType, credentials)) {
    if (instanceOfAzureCredential<AzureClientSecretCredentials>('clientsecret', credentials.serviceCredentials)) {
      const serviceCredentials = { ...credentials.serviceCredentials, clientSecret: getSecret(options) };
      return {
        authType,
        serviceCredentialsEnabled: credentials.serviceCredentialsEnabled,
        serviceCredentials,
      };
    }
    return {
      authType,
      serviceCredentialsEnabled: credentials.serviceCredentialsEnabled,
      serviceCredentials: credentials.serviceCredentials,
    };
  }
  return {
    authType: 'clientsecret',
    azureCloud: getDefaultAzureCloud(),
  };
}

export function updateCredentials(
  options: AzureDataSourceSettings,
  credentials: AzureCredentials
): AzureDataSourceSettings {
  switch (credentials.authType) {
    case 'msi':
    case 'workloadidentity':
      if (credentials.authType === 'msi' && !config.azure.managedIdentityEnabled) {
        throw new Error('Managed Identity authentication is not enabled in Grafana config.');
      }
      if (credentials.authType === 'workloadidentity' && !config.azure.workloadIdentityEnabled) {
        throw new Error('Workload Identity authentication is not enabled in Grafana config.');
      }

      options = {
        ...options,
        jsonData: {
          ...options.jsonData,
          azureAuthType: credentials.authType,
          azureCredentials: {
            authType: credentials.authType,
          },
        },
      };

      return options;

    case 'clientsecret':
      options = {
        ...options,
        jsonData: {
          ...options.jsonData,
          azureAuthType: credentials.authType,
          cloudName: resolveLegacyCloudName(credentials.azureCloud) || getDefaultAzureCloud(),
          tenantId: credentials.tenantId,
          clientId: credentials.clientId,
          azureCredentials: {
            authType: credentials.authType,
            azureCloud: resolveLegacyCloudName(credentials.azureCloud) || getDefaultAzureCloud(),
            tenantId: credentials.tenantId,
            clientId: credentials.clientId,
          },
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
  }
  if (instanceOfAzureCredential<AadCurrentUserCredentials>('currentuser', credentials)) {
    const serviceCredentials = credentials.serviceCredentials;
    let clientSecret: string | symbol | undefined;
    if (instanceOfAzureCredential<AzureClientSecretCredentials>('clientsecret', serviceCredentials)) {
      clientSecret = serviceCredentials.clientSecret;
      // Do this to not expose the secret in unencrypted JSON data
      delete serviceCredentials.clientSecret;
    }
    options = {
      ...options,
      jsonData: {
        ...options.jsonData,
        azureAuthType: credentials.authType,
        azureCredentials: {
          authType: 'currentuser',
          serviceCredentialsEnabled: credentials.serviceCredentialsEnabled,
          serviceCredentials,
        },
        oauthPassThru: true,
        disableGrafanaCache: true,
      },
      secureJsonData: {
        ...options.secureJsonData,
        clientSecret: typeof clientSecret === 'string' ? clientSecret : undefined,
      },
      secureJsonFields: {
        ...options.secureJsonFields,
        clientSecret: typeof clientSecret === 'symbol',
      },
    };
  }
  return options;
}
