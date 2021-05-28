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
    case AzureCloud.Germany:
      return 'germanyazuremonitor';
    default:
      throw new Error(`The cloud '${config.azure.cloud}' not supported.`);
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

function getLogAnalyticsSecret(options: AzureDataSourceSettings): undefined | string | ConcealedSecret {
  if (options.secureJsonFields.logAnalyticsClientSecret) {
    // The secret is concealed on server
    return concealed;
  } else {
    const secret = options.secureJsonData?.logAnalyticsClientSecret;
    return typeof secret === 'string' && secret.length > 0 ? secret : undefined;
  }
}

function isLogAnalyticsSameAs(options: AzureDataSourceSettings | AzureDataSourceInstanceSettings): boolean {
  return typeof options.jsonData.azureLogAnalyticsSameAs !== 'boolean' || options.jsonData.azureLogAnalyticsSameAs;
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
          defaultSubscriptionId: options.jsonData.subscriptionId,
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
        defaultSubscriptionId: options.jsonData.subscriptionId,
      };
  }
}

export function getLogAnalyticsCredentials(options: AzureDataSourceSettings): AzureCredentials | undefined {
  const authType = getAuthType(options);

  if (authType !== 'clientsecret') {
    // Only app registration (client secret) authentication supports different credentials for Log Analytics
    // for backward compatibility
    return undefined;
  }

  if (isLogAnalyticsSameAs(options)) {
    return undefined;
  }

  return {
    authType: 'clientsecret',
    azureCloud: options.jsonData.cloudName || getDefaultAzureCloud(),
    tenantId: options.jsonData.logAnalyticsTenantId,
    clientId: options.jsonData.logAnalyticsClientId,
    clientSecret: getLogAnalyticsSecret(options),
    defaultSubscriptionId: options.jsonData.logAnalyticsSubscriptionId,
  };
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
          subscriptionId: credentials.defaultSubscriptionId,
        },
      };

      if (!isLogAnalyticsSameAs(options)) {
        options = updateLogAnalyticsSameAs(options, true);
      } else {
        options = updateLogAnalyticsCredentials(options, credentials);
      }

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
          subscriptionId: credentials.defaultSubscriptionId,
        },
        secureJsonData: {
          ...options.secureJsonData,
          clientSecret:
            typeof credentials.clientSecret === 'string' && credentials.clientSecret.length > 0
              ? credentials.clientSecret
              : undefined,
        },
        secureJsonFields: {
          ...options.secureJsonFields,
          clientSecret: typeof credentials.clientSecret === 'symbol',
        },
      };

      if (isLogAnalyticsSameAs(options)) {
        options = updateLogAnalyticsCredentials(options, credentials);
      }

      return options;
  }
}

export function updateLogAnalyticsCredentials(
  options: AzureDataSourceSettings,
  credentials: AzureCredentials
): AzureDataSourceSettings {
  // Log Analytics credentials only used if primary credentials are App Registration (client secret)
  if (credentials.authType === 'clientsecret') {
    options = {
      ...options,
      jsonData: {
        ...options.jsonData,
        logAnalyticsTenantId: credentials.tenantId,
        logAnalyticsClientId: credentials.clientId,
      },
      secureJsonData: {
        ...options.secureJsonData,
        logAnalyticsClientSecret:
          typeof credentials.clientSecret === 'string' && credentials.clientSecret.length > 0
            ? credentials.clientSecret
            : undefined,
      },
      secureJsonFields: {
        ...options.secureJsonFields,
        logAnalyticsClientSecret: typeof credentials.clientSecret === 'symbol',
      },
    };
  }

  // Default subscription
  options = {
    ...options,
    jsonData: {
      ...options.jsonData,
      logAnalyticsSubscriptionId: credentials.defaultSubscriptionId,
    },
  };

  return options;
}

export function updateLogAnalyticsSameAs(options: AzureDataSourceSettings, sameAs: boolean): AzureDataSourceSettings {
  if (sameAs !== isLogAnalyticsSameAs(options)) {
    // Update the 'Same As' switch
    options = {
      ...options,
      jsonData: {
        ...options.jsonData,
        azureLogAnalyticsSameAs: sameAs,
      },
    };

    if (sameAs) {
      // Get the primary credentials
      let credentials = getCredentials(options);

      // Check whether the primary client secret is concealed
      if (credentials.authType === 'clientsecret' && typeof credentials.clientSecret === 'symbol') {
        // Log Analytics credentials need to be synchronized but the client secret is concealed,
        // so we have to reset the primary client secret to ensure that user enters a new secret
        credentials.clientSecret = undefined;
        options = updateCredentials(options, credentials);
      }

      // Synchronize the Log Analytics credentials with primary credentials
      options = updateLogAnalyticsCredentials(options, credentials);
    }
  }

  return options;
}

export function isAppInsightsConfigured(options: AzureDataSourceSettings) {
  return !!(options.jsonData.appInsightsAppId && options.secureJsonFields.appInsightsApiKey);
}
