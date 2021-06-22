import { DataSourceSettings } from '@grafana/data';
import { config } from '@grafana/runtime';
import { AzureAuthType, AzureCloud, AzureCredentials, ConcealedSecret } from './AzureCredentials';

const concealed: ConcealedSecret = Symbol('Concealed client secret');

function getAuthType(options: DataSourceSettings<any, any>): AzureAuthType {
  if (!options.jsonData.azureAuthType) {
    // For newly created datasource with no configuration, managed identity is the default authentication type
    // if they are enabled in Grafana config
    return config.azure.managedIdentityEnabled ? 'msi' : 'clientsecret';
  }

  return options.jsonData.azureAuthType;
}

function getDefaultAzureCloud(): string {
  return config.azure.cloud || AzureCloud.Public;
}

export function getAzureCloud(options: DataSourceSettings<any, any>): string {
  const authType = getAuthType(options);
  switch (authType) {
    case 'msi':
      // In case of managed identity, the cloud is always same as where Grafana is hosted
      return getDefaultAzureCloud();
    case 'clientsecret':
      return options.jsonData.azureCloud || getDefaultAzureCloud();
  }
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

export function getCredentials(options: DataSourceSettings<any, any>): AzureCredentials {
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
        azureCloud: options.jsonData.azureCloud || getDefaultAzureCloud(),
        tenantId: options.jsonData.azureTenantId,
        clientId: options.jsonData.azureClientId,
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
          azureCloud: credentials.azureCloud || getDefaultAzureCloud(),
          azureTenantId: credentials.tenantId,
          azureClientId: credentials.clientId,
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
