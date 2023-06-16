import { DataSourceSettings } from '@grafana/data';
import { GrafanaBootConfig } from '@grafana/runtime';

// JEV: remove unnecessary exports
export enum AzureCloud {
  Public = 'AzureCloud',
}

export type AzureAuthType = 'msi' | 'clientsecret';

export type ConcealedSecret = symbol;

interface AzureCredentialsBase {
  authType: AzureAuthType;
  defaultSubscriptionId?: string;
}

export interface AzureManagedIdentityCredentials extends AzureCredentialsBase {
  authType: 'msi';
}

export interface AzureClientSecretCredentials extends AzureCredentialsBase {
  authType: 'clientsecret';
  azureCloud?: string;
  tenantId?: string;
  clientId?: string;
  clientSecret?: string | ConcealedSecret;
}

export type AzureCredentials = AzureManagedIdentityCredentials | AzureClientSecretCredentials;

export const dataSourceHasCredentials = (options: DataSourceSettings<any, any>): boolean =>
  !!options.jsonData.azureCredentials;

export const setDefaultCredentials = (
  dsSettings: DataSourceSettings<any, any>,
  bootConfig: GrafanaBootConfig
): Partial<DataSourceSettings<any, any>> => ({
  jsonData: {
    ...dsSettings.jsonData,
    azureCredentials: getDefaultCredentials(bootConfig),
  },
});

export const resetCredentials = (dsSettings: DataSourceSettings<any, any>): Partial<DataSourceSettings<any, any>> => ({
  jsonData: {
    ...dsSettings.jsonData,
    azureAuth: undefined,
    azureCredentials: undefined,
    azureEndpointResourceId: undefined,
  },
});

export const setDataSourceCredentials = (
  dsSettings: DataSourceSettings<any, any>,
  bootConfig: GrafanaBootConfig,
  enabled: boolean
): Partial<DataSourceSettings<any, any>> =>
  enabled ? setDefaultCredentials(dsSettings, bootConfig) : resetCredentials(dsSettings);

const getDefaultAzureCloud = (bootConfig: GrafanaBootConfig): string => {
  return bootConfig.azure.cloud || AzureCloud.Public;
};

export const getDefaultCredentials = (bootConfig: GrafanaBootConfig): AzureCredentials => {
  if (bootConfig.azure.managedIdentityEnabled) {
    return { authType: 'msi' };
  } else {
    return { authType: 'clientsecret', azureCloud: getDefaultAzureCloud(bootConfig) };
  }
};

export const getCredentials = (
  dsSettings: DataSourceSettings<any, any>,
  bootConfig: GrafanaBootConfig
): AzureCredentials => {
  const credentials = dsSettings.jsonData.azureCredentials as AzureCredentials | undefined;

  // If no credentials saved, then return empty credentials
  // of type based on whether the managed identity enabled
  if (!credentials) {
    return getDefaultCredentials(bootConfig);
  }

  switch (credentials.authType) {
    case 'msi':
      if (bootConfig.azure.managedIdentityEnabled) {
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
};
