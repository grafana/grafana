import { AzureCredentials, AzureDataSourceInstanceSettings, AzureDataSourceSettings, ConcealedSecret } from './types';

const concealed: ConcealedSecret = Symbol('Concealed client secret');

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
  return !!(credentials.tenantId && credentials.clientId && credentials.clientSecret);
}

export function getCredentials(options: AzureDataSourceSettings): AzureCredentials {
  return {
    azureCloud: getAzureCloud(options),
    tenantId: options.jsonData.tenantId,
    clientId: options.jsonData.clientId,
    clientSecret: getSecret(options),
  };
}

export function getLogAnalyticsCredentials(options: AzureDataSourceSettings): AzureCredentials | undefined {
  if (isLogAnalyticsSameAs(options)) {
    return undefined;
  }

  return {
    azureCloud: getAzureCloud(options),
    tenantId: options.jsonData.logAnalyticsTenantId,
    clientId: options.jsonData.logAnalyticsClientId,
    clientSecret: getLogAnalyticsSecret(options),
  };
}

export function updateCredentials(
  options: AzureDataSourceSettings,
  credentials: AzureCredentials
): AzureDataSourceSettings {
  options = {
    ...options,
    jsonData: {
      ...options.jsonData,
      cloudName: credentials.azureCloud || 'azuremonitor',
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
      clientSecret: typeof credentials.clientSecret === 'symbol',
    },
  };

  if (isLogAnalyticsSameAs(options)) {
    options = updateLogAnalyticsCredentials(options, credentials);
  }

  return options;
}

export function updateLogAnalyticsCredentials(
  options: AzureDataSourceSettings,
  credentials: AzureCredentials
): AzureDataSourceSettings {
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
