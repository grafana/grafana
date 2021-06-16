import { DataSourceSettings } from '@grafana/data';
import { AzureSettings } from './types';
import { AzureAuthType, AzureCloud, AzureCredentials, ConcealedSecret } from './AzureCredentials';

const concealed: ConcealedSecret = Symbol('Concealed client secret');

function getAuthType(options: DataSourceSettings<any, any>, settings: AzureSettings): AzureAuthType {
  if (!options.jsonData.azureAuthType) {
    // For newly created datasource with no configuration, managed identity is the default authentication type
    // if they are enabled in Grafana config
    return settings.managedIdentityEnabled ? 'msi' : 'clientsecret';
  }

  return options.jsonData.azureAuthType;
}

function getDefaultAzureCloud(settings: AzureSettings): string {
  return settings.cloud || AzureCloud.Public;
}

export function getAzureCloud(options: DataSourceSettings<any, any>, settings: AzureSettings): string {
  const authType = getAuthType(options, settings);
  switch (authType) {
    case 'msi':
      // In case of managed identity, the cloud is always same as where Grafana is hosted
      return getDefaultAzureCloud(settings);
    case 'clientsecret':
      return options.jsonData.azureCloud || getDefaultAzureCloud(settings);
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

export function getCredentials(options: DataSourceSettings<any, any>, settings: AzureSettings): AzureCredentials {
  const authType = getAuthType(options, settings);
  switch (authType) {
    case 'msi':
      if (settings.managedIdentityEnabled) {
        return {
          authType: 'msi',
        };
      } else {
        // If authentication type is managed identity but managed identities were disabled in Grafana config,
        // then we should fallback to an empty app registration (client secret) configuration
        return {
          authType: 'clientsecret',
          azureCloud: getDefaultAzureCloud(settings),
        };
      }
    case 'clientsecret':
      return {
        authType: 'clientsecret',
        azureCloud: options.jsonData.azureCloud || getDefaultAzureCloud(settings),
        tenantId: options.jsonData.azureTenantId,
        clientId: options.jsonData.azureClientId,
        clientSecret: getSecret(options),
      };
  }
}

export function updateCredentials(
  options: DataSourceSettings<any, any>,
  credentials: AzureCredentials,
  settings: AzureSettings
): DataSourceSettings<any, any> {
  switch (credentials.authType) {
    case 'msi':
      if (!settings.managedIdentityEnabled) {
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
          azureCloud: credentials.azureCloud || getDefaultAzureCloud(settings),
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
