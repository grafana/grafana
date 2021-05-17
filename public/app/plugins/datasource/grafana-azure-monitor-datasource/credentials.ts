import { config } from '@grafana/runtime';
import {
  AzureAuthType,
  AzureCredentials,
  AzureDataSourceInstanceSettings,
  AzureDataSourceSettings,
  ConcealedSecret,
} from './types';

const concealed: ConcealedSecret = Symbol('Concealed client secret');

function getAuthType(options: AzureDataSourceSettings): AzureAuthType {
  if (options.jsonData.azureAuthType) {
    return options.jsonData.azureAuthType;
  }

  // TODO: Give explanation of the logic
  if (options.jsonData.tenantId || options.jsonData.clientId) {
    // Credentials are already configured but authentication type isn't selected
    // It means existing data source which needs to default to App Registration
    return 'clientsecret';
  } else {
    return config.azure.managedIdentityEnabled ? 'msi' : 'clientsecret';
  }
}

export function getAzureCloud(options: AzureDataSourceSettings | AzureDataSourceInstanceSettings): string {
  return options.jsonData.cloudName || 'azuremonitor';
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

export function isLogAnalyticsSameAs(options: AzureDataSourceSettings): boolean {
  return typeof options.jsonData.azureLogAnalyticsSameAs !== 'boolean' || options.jsonData.azureLogAnalyticsSameAs;
}

export function isCredentialsComplete(credentials: AzureCredentials) {
  switch (credentials.authType) {
    case 'msi':
      return true;
    case 'clientsecret':
      return !!(credentials.azureCloud && credentials.tenantId && credentials.clientId && credentials.clientSecret);
  }
  // TODO: Fail if auth type not supported
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
        // TODO: Explain why
        return {
          authType: 'clientsecret',
          azureCloud: 'azuremonitor', // TODO: Default cloud should be based on Grafana configuration
        };
      }
    case 'clientsecret':
      return {
        authType: 'clientsecret',
        azureCloud: options.jsonData.cloudName || 'azuremonitor', // TODO: Default cloud should be based on Grafana configuration
        tenantId: options.jsonData.tenantId,
        clientId: options.jsonData.clientId,
        clientSecret: getSecret(options),
      };
  }
  // TODO: Fail if auth type not supported
}

export function getLogAnalyticsCredentials(options: AzureDataSourceSettings): AzureCredentials | undefined {
  const authType = getAuthType(options);

  if (authType !== 'clientsecret') {
    // TODO: Explain why
    return undefined;
  }

  if (isLogAnalyticsSameAs(options)) {
    return undefined;
  }

  return {
    authType: 'clientsecret',
    azureCloud: options.jsonData.cloudName || 'azuremonitor', // TODO: Default cloud should be based on Grafana configuration
    tenantId: options.jsonData.logAnalyticsTenantId,
    clientId: options.jsonData.logAnalyticsClientId,
    clientSecret: getLogAnalyticsSecret(options),
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
          azureAuthType: credentials.authType,
        },
      };
      break;
    case 'clientsecret':
      options = {
        ...options,
        jsonData: {
          ...options.jsonData,
          azureAuthType: credentials.authType,
          cloudName: credentials.azureCloud || 'azuremonitor', // TODO: Default cloud should be based on Grafana configuration
          tenantId: credentials.tenantId,
          clientId: credentials.clientId,
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
          clientSecret: typeof credentials.clientSecret === 'object',
        },
      };

      if (isLogAnalyticsSameAs(options)) {
        options = updateLogAnalyticsCredentials(options, credentials);
      }
      break;
  }
  // TODO: Fail if auth type not supported

  return options;
}

export function updateLogAnalyticsCredentials(
  options: AzureDataSourceSettings,
  credentials: AzureCredentials
): AzureDataSourceSettings {
  if (credentials.authType !== 'clientsecret') {
    throw new Error('Log Analytics specific authentication can only be App Registration.');
  }

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

      if (credentials.authType !== 'clientsecret') {
        throw new Error('Log Analytics specific authentication can only be App Registration.');
      }
      // Check whether the client secret is concealed
      if (typeof credentials.clientSecret === 'symbol') {
        // Log Analytics credentials need to be synchronized but the client secret is concealed,
        // so we have to reset the primary client secret to ensure that user enters a new secret
        credentials.clientSecret = undefined;
        options = updateCredentials(options, credentials);
      }

      // Synchronize the Log Analytics credentials with primary credentials
      options = updateLogAnalyticsCredentials(options, credentials);

      // Synchronize default subscription
      options = {
        ...options,
        jsonData: {
          ...options.jsonData,
          logAnalyticsSubscriptionId: options.jsonData.subscriptionId,
        },
      };
    }
  }

  return options;
}
