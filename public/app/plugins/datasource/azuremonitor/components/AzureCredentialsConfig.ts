import { AzureAuthType, AzureCredentials, ConcealedSecret } from '@grafana/azure-sdk';
import { config } from '@grafana/runtime';

import {
  AzureDataSourceInstanceSettings,
  AzureDataSourceSettings
} from "../types";

import { AzureCloud } from './AzureCredentials';

const concealed: ConcealedSecret = Symbol('Concealed client secret');
const concealedLegacy: ConcealedSecret = Symbol('Concealed legacy client secret');

function getDefaultAzureCloud(): string {
  return config.azure.cloud || AzureCloud.Public;
}

function isInstanceSettings(options: AzureDataSourceSettings | AzureDataSourceInstanceSettings): options is AzureDataSourceInstanceSettings {
  return !options.hasOwnProperty('secureJsonFields');
}

function getSecret(options: AzureDataSourceSettings): undefined | string | ConcealedSecret {
  if (options.secureJsonFields.azureClientSecret) {
    // The secret is concealed on server
    return concealed;
  } else if (options.secureJsonFields.clientSecret) {
    // A legacy secret field was preserved during migration
    return concealedLegacy;
  } else {
    const secret = options.secureJsonData?.azureClientSecret;
    return typeof secret === 'string' && secret.length > 0 ? secret : undefined;
  }
}

export function hasCredentials(options: AzureDataSourceSettings): boolean {
  if (typeof options.jsonData.azureCredentials === 'object') {
    // Credentials in common format
    return true;
  } else if (typeof options.jsonData.azureAuthType === 'string') {
    // Credentials in legacy format
    return true;
  } else {
    // Oldest legacy format before auth type was used (App Registration only)
    return typeof options.jsonData.tenantId === 'string' || typeof options.jsonData.clientId === 'string';
  }
}

export function getDefaultCredentials(): AzureCredentials {
  if (config.azure.managedIdentityEnabled) {
    return { authType: 'msi' };
  } else if (config.azure.workloadIdentityEnabled) {
    return { authType: 'workloadidentity' };
  } else {
    return { authType: 'clientsecret', azureCloud: getDefaultAzureCloud() };
  }
}

export function getCredentials(options: AzureDataSourceSettings | AzureDataSourceInstanceSettings): AzureCredentials {
  const credentials = options.jsonData.azureCredentials;

  // If no credentials saved then try to restore legacy credentials, otherwise return default credentials
  if (!credentials) {
    let legacyCredentials: AzureCredentials | undefined = undefined;
    try {
      legacyCredentials = getLegacyCredentials(options);
    } catch (e) {
      if (e instanceof Error) {
        console.error('Unable to restore legacy credentials: %s', e.message);
      }
    }
    return legacyCredentials ?? getDefaultCredentials();
  }

  switch (credentials.authType) {
    case 'msi':
      if (config.azure.managedIdentityEnabled) {
        return {
          authType: 'msi',
        };
      } else {
        // If authentication type is managed identity but managed identities were disabled in Grafana config,
        // then we should fall back to an empty default credentials
        return getDefaultCredentials();
      }
    case 'workloadidentity':
      if (config.azure.workloadIdentityEnabled) {
        return {
          authType: 'workloadidentity',
        };
      } else {
        // If authentication type is workload identity but workload identity is disabled in Grafana config,
        // then we should fall back to an empty default credentials
        return getDefaultCredentials();
      }
    case 'clientsecret':
      return {
        authType: credentials.authType,
        azureCloud: credentials.azureCloud || getDefaultAzureCloud(),
        tenantId: credentials.tenantId,
        clientId: credentials.clientId,
        clientSecret: !isInstanceSettings(options) ? getSecret(options) : undefined,
      };
    default:
      throw new Error(`The auth type '${credentials.authType}' not supported by the datasource.`);
  }
}

function getLegacyCredentials(options: AzureDataSourceSettings | AzureDataSourceInstanceSettings): AzureCredentials | undefined {
  let authType: AzureAuthType | undefined = typeof options.jsonData.azureAuthType === 'string' ?
    options.jsonData.azureAuthType as AzureAuthType : undefined;
  if (!authType) {
    // If authentication type isn't explicitly specified and datasource has client credentials,
    // then this is existing datasource which is configured for app registration (client secret)
    if (typeof options.jsonData.tenantId === 'string' || typeof options.jsonData.clientId === 'string') {
      authType = 'clientsecret';
    }
  }

  // Supported legacy credentials
  switch (authType) {
    case 'msi':
      if (config.azure.managedIdentityEnabled) {
        return {
          authType: 'msi',
        };
      } else {
        // If authentication type is managed identity but managed identities were disabled in Grafana config,
        // then we should fall back to an empty default credentials
        return getDefaultCredentials();
      }
    case 'workloadidentity':
      if (config.azure.workloadIdentityEnabled) {
        return {
          authType: 'workloadidentity',
        };
      } else {
        // If authentication type is workload identity but workload identity is disabled in Grafana config,
        // then we should fall back to an empty default credentials
        return getDefaultCredentials();
      }
    case 'clientsecret':
      const azureCloud = resolveLegacyCloudName(typeof options.jsonData.cloudName === 'string' ? options.jsonData.cloudName : undefined);
      return {
        authType: 'clientsecret',
        azureCloud: azureCloud,
        tenantId: typeof options.jsonData.tenantId === 'string' ? options.jsonData.tenantId : '',
        clientId: typeof options.jsonData.clientId === 'string' ? options.jsonData.clientId : '',
        clientSecret: !isInstanceSettings(options) && options.secureJsonFields.clientSecret ? concealedLegacy : undefined,
      };
  }

  // No legacy credentials discovered
  return undefined;
}

function resolveLegacyCloudName(cloudName: string | undefined): AzureCloud {
  if (!cloudName) {
    return AzureCloud.Public;
  }

  switch (cloudName) {
    case 'azuremonitor':
      return AzureCloud.Public;
    case 'chinaazuremonitor':
      return AzureCloud.China;
    case 'govazuremonitor':
      return AzureCloud.USGovernment;
    default:
      throw new Error(`Azure cloud '${cloudName}' not supported by the datasource.`);
  }
}

export function updateCredentials(options: AzureDataSourceSettings, credentials: AzureCredentials): AzureDataSourceSettings {
  // Cleanup legacy credentials
  options = {
    ...options,
    jsonData: {
      ...options.jsonData,
      azureAuthType: undefined,
      cloudName: undefined,
      tenantId: undefined,
      clientId: undefined,
    },
  };

  // Apply updated credentials
  switch (credentials.authType) {
    case 'msi':
      if (!config.azure.managedIdentityEnabled) {
        throw new Error('Managed Identity authentication is not enabled in Grafana config.');
      }
      options = {
        ...options,
        jsonData: {
          ...options.jsonData,
          azureCredentials: {
            authType: 'msi',
          },
        },
      };
      break;
    case 'workloadidentity':
      if (!config.azure.workloadIdentityEnabled) {
        throw new Error('Workload Identity authentication is not enabled in Grafana config.');
      }
      options = {
        ...options,
        jsonData: {
          ...options.jsonData,
          azureCredentials: {
            authType: 'workloadidentity',
          },
        },
      };
      break;

    case 'clientsecret':
      options = {
        ...options,
        jsonData: {
          ...options.jsonData,
          azureCredentials: {
            authType: credentials.authType,
            azureCloud: credentials.azureCloud || getDefaultAzureCloud(),
            tenantId: credentials.tenantId,
            clientId: credentials.clientId,
          },
        },
        secureJsonData: {
          ...options.secureJsonData,
          azureClientSecret:
            typeof credentials.clientSecret === 'string' && credentials.clientSecret.length > 0
              ? credentials.clientSecret
              : undefined,
        },
        secureJsonFields: {
          ...options.secureJsonFields,
          azureClientSecret: credentials.clientSecret === concealed,
          clientSecret: credentials.clientSecret === concealedLegacy,
        },
      };
      break;
  }

  return options;
}

export function isCredentialsComplete(credentials: AzureCredentials): boolean {
  switch (credentials.authType) {
    case 'currentuser':
    case 'msi':
    case 'workloadidentity':
      return true;
    case 'clientsecret':
    case 'clientsecret-obo':
      return !!(credentials.azureCloud && credentials.tenantId && credentials.clientId && credentials.clientSecret);
  }
}
