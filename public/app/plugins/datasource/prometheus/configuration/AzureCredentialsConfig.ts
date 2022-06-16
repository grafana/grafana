import { DataSourceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';

import { AzureCloud, AzureCredentials, ConcealedSecret } from './AzureCredentials';

const concealed: ConcealedSecret = Symbol('Concealed client secret');

function getDefaultAzureCloud(): string {
  return config.azure.cloud || AzureCloud.Public;
}

function getSecret(options: DataSourceSettings<any, any>): undefined | string | ConcealedSecret {
  if (options.secureJsonFields.azureClientSecret) {
    // The secret is concealed on server
    return concealed;
  } else {
    const secret = options.secureJsonData?.azureClientSecret;
    return typeof secret === 'string' && secret.length > 0 ? secret : undefined;
  }
}

export function hasCredentials(options: DataSourceSettings<any, any>): boolean {
  return !!options.jsonData.azureCredentials;
}

export function getDefaultCredentials(): AzureCredentials {
  if (config.azure.managedIdentityEnabled) {
    return { authType: 'msi' };
  } else {
    return { authType: 'clientsecret', azureCloud: getDefaultAzureCloud() };
  }
}

export function getCredentials(options: DataSourceSettings<any, any>): AzureCredentials {
  const credentials = options.jsonData.azureCredentials as AzureCredentials | undefined;

  // If no credentials saved, then return empty credentials
  // of type based on whether the managed identity enabled
  if (!credentials) {
    return getDefaultCredentials();
  }

  switch (credentials.authType) {
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
        azureCloud: credentials.azureCloud || getDefaultAzureCloud(),
        tenantId: credentials.tenantId,
        clientId: credentials.clientId,
        clientSecret: getSecret(options),
      };
  }
}

export function updateCredentials(
  options: DataSourceSettings<any, any>,
  credentials: AzureCredentials
): DataSourceSettings<any, any> {
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

      return options;

    case 'clientsecret':
      options = {
        ...options,
        jsonData: {
          ...options.jsonData,
          azureCredentials: {
            authType: 'clientsecret',
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
          azureClientSecret: typeof credentials.clientSecret === 'symbol',
        },
      };

      return options;
  }
}

export function setDefaultCredentials(options: DataSourceSettings<any, any>): Partial<DataSourceSettings<any, any>> {
  return {
    jsonData: {
      ...options.jsonData,
      azureCredentials: getDefaultCredentials(),
    },
  };
}

export function resetCredentials(options: DataSourceSettings<any, any>): Partial<DataSourceSettings<any, any>> {
  return {
    jsonData: {
      ...options.jsonData,
      azureAuth: undefined,
      azureCredentials: undefined,
      azureEndpointResourceId: undefined,
    },
  };
}
