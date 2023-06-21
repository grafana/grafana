import { DataSourceSettings } from '@grafana/data';
import { GrafanaBootConfig } from '@grafana/runtime';
import { HttpSettingsBaseProps } from '@grafana/ui/src/components/DataSourceSettings/types';

import { AzureCloud, AzureCredentials, ConcealedSecret } from './AzureCredentials';

export type AzureAuthConfigType = {
  azureAuthIsSupported: boolean;
  azureAuthSettingsUI: (props: HttpSettingsBaseProps) => JSX.Element;
};

const concealed: ConcealedSecret = Symbol('Concealed client secret');

const getDefaultAzureCloud = (bootConfig: GrafanaBootConfig): string => {
  return bootConfig.azure.cloud || AzureCloud.Public;
};

const getDefaultCredentials = (bootConfig: GrafanaBootConfig): AzureCredentials => {
  if (bootConfig.azure.managedIdentityEnabled) {
    return { authType: 'msi' };
  } else {
    return { authType: 'clientsecret', azureCloud: getDefaultAzureCloud(bootConfig) };
  }
};

const getSecret = (dsSettings: DataSourceSettings<any, any>): undefined | string | ConcealedSecret => {
  if (dsSettings.secureJsonFields.azureClientSecret) {
    // The secret is concealed on server
    return concealed;
  } else {
    const secret = dsSettings.secureJsonData?.azureClientSecret;
    return typeof secret === 'string' && secret.length > 0 ? secret : undefined;
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
          azureCloud: getDefaultAzureCloud(bootConfig),
        };
      }
    case 'clientsecret':
      return {
        authType: 'clientsecret',
        azureCloud: credentials.azureCloud || getDefaultAzureCloud(bootConfig),
        tenantId: credentials.tenantId,
        clientId: credentials.clientId,
        clientSecret: getSecret(dsSettings),
      };
  }
};

export const updateCredentials = (
  dsSettings: DataSourceSettings<any, any>,
  bootConfig: GrafanaBootConfig,
  credentials: AzureCredentials
): DataSourceSettings<any, any> => {
  switch (credentials.authType) {
    case 'msi':
      if (!bootConfig.azure.managedIdentityEnabled) {
        throw new Error('Managed Identity authentication is not enabled in Grafana config.');
      }

      dsSettings = {
        ...dsSettings,
        jsonData: {
          ...dsSettings.jsonData,
          azureCredentials: {
            authType: 'msi',
          },
        },
      };

      return dsSettings;

    case 'clientsecret':
      dsSettings = {
        ...dsSettings,
        jsonData: {
          ...dsSettings.jsonData,
          azureCredentials: {
            authType: 'clientsecret',
            azureCloud: credentials.azureCloud || getDefaultAzureCloud(bootConfig),
            tenantId: credentials.tenantId,
            clientId: credentials.clientId,
          },
        },
        secureJsonData: {
          ...dsSettings.secureJsonData,
          azureClientSecret:
            typeof credentials.clientSecret === 'string' && credentials.clientSecret.length > 0
              ? credentials.clientSecret
              : undefined,
        },
        secureJsonFields: {
          ...dsSettings.secureJsonFields,
          azureClientSecret: typeof credentials.clientSecret === 'symbol',
        },
      };

      return dsSettings;
  }
};
