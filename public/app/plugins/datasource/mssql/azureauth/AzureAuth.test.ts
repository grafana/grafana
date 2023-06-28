import { AzureCloud, AzureCredentialsType, ConcealedSecretType } from '../types';

import {
  configWithManagedIdentityEnabled,
  configWithManagedIdentityDisabled,
  dataSourceSettingsWithMsiCredentials,
  dataSourceSettingsWithClientSecretOnServer,
  dataSourceSettingsWithClientSecretInSecureJSONData,
} from './AzureAuth.testMocks';
import { getDefaultCredentials, getSecret, getCredentials, updateCredentials } from './AzureCredentialsConfig';

export const CLIENT_SECRET_SYMBOL: ConcealedSecretType = Symbol('Concealed client secret');

export const CLIENT_SECRET_STRING = 'XXXX-super-secret-secret-XXXX';

describe('AzureAuth', () => {
  describe('AzureCredentialsConfig', () => {
    it('`getDefaultCredentials()` should return the correct credentials based on whether the managed identity is enabled', () => {
      const resultForManagedIdentityEnabled = getDefaultCredentials(true, AzureCloud.Public);
      const resultForManagedIdentityDisabled = getDefaultCredentials(false, AzureCloud.Public);

      expect(resultForManagedIdentityEnabled).toEqual({ authType: 'msi' });

      expect(resultForManagedIdentityDisabled).toEqual({ authType: 'clientsecret', azureCloud: 'AzureCloud' });
    });

    it("`getSecret()` should correctly return the client secret if it's not concealed", () => {
      const resultFromServerSideSecret = getSecret(false, CLIENT_SECRET_SYMBOL);
      expect(resultFromServerSideSecret).toBe(CLIENT_SECRET_SYMBOL);

      const resultFromSecureJSONDataSecret = getSecret(true, CLIENT_SECRET_STRING);
      expect(resultFromSecureJSONDataSecret).toBe(CLIENT_SECRET_STRING);
    });

    describe('getCredentials()', () => {
      it('should return the correct managed identity credentials', () => {
        // If `dataSourceSettings.authType === "msi"` && `config.azure.managedIdentityEnabled === true`.
        const resultForManagedIdentityEnabled = getCredentials(
          dataSourceSettingsWithMsiCredentials,
          configWithManagedIdentityEnabled
        );
        expect(resultForManagedIdentityEnabled).toEqual({ authType: 'msi' });

        // If `dataSourceSettings.authType === "msi"` but `config.azure.managedIdentityEnabled !== true`.
        // Default to basic client secret credentials.
        const resultForManagedIdentityEnabledInJSONButDisabledInConfig = getCredentials(
          dataSourceSettingsWithMsiCredentials,
          configWithManagedIdentityDisabled
        );
        expect(resultForManagedIdentityEnabledInJSONButDisabledInConfig).toEqual({
          authType: 'clientsecret',
          azureCloud: 'AzureCloud',
        });
      });

      it('should return the correct client secret credentials', () => {
        const basicExpectedResult = {
          authType: 'clientsecret',
          azureCloud: 'AzureCloud',
          tenantId: 'XXXX-tenant-id-XXXX',
          clientId: 'XXXX-client-id-XXXX',
        };

        // If `dataSourceSettings.authType === "clientsecret"` && `secureJsonFields.azureClientSecret == true`,
        // i.e. the client secret is stored on the server.
        const resultForClientSecretCredentialsOnServer = getCredentials(
          dataSourceSettingsWithClientSecretOnServer,
          configWithManagedIdentityDisabled
        );

        expect(resultForClientSecretCredentialsOnServer).toEqual({
          ...basicExpectedResult,
          clientSecret: CLIENT_SECRET_SYMBOL,
        });

        //   If `dataSourceSettings.authType === "clientsecret"` && `secureJsonFields.azureClientSecret == false`,
        //   i.e. the client secret is stored in the secureJson.
        const resultForClientSecretCredentialsInSecureJSON = getCredentials(
          dataSourceSettingsWithClientSecretInSecureJSONData,
          configWithManagedIdentityDisabled
        );
        expect(resultForClientSecretCredentialsInSecureJSON).toEqual({
          ...basicExpectedResult,
          clientSecret: CLIENT_SECRET_STRING,
        });
      });
    });

    describe('updateCredentials()', () => {
      it('should update the credentials for managed service identity correctly', () => {
        // If `dataSourceSettings.authType === "msi"` && `config.azure.managedIdentityEnabled === true`.
        const resultForMsiCredentials = updateCredentials(
          dataSourceSettingsWithMsiCredentials,
          configWithManagedIdentityEnabled,
          {
            authType: 'msi',
          }
        );
        expect(resultForMsiCredentials).toEqual({ jsonData: { azureCredentials: { authType: 'msi' } } });

        // If `dataSourceSettings.authType === "msi"` but `config.azure.managedIdentityEnabled !== true`.
        expect(() =>
          updateCredentials(dataSourceSettingsWithMsiCredentials, configWithManagedIdentityDisabled, {
            authType: 'msi',
          })
        ).toThrow('Managed Identity authentication is not enabled in Grafana config.');
      });

      it('should update the credentials for client secret correctly', () => {
        const basicClientSecretCredentials: AzureCredentialsType = {
          authType: 'clientsecret',
          azureCloud: 'AzureCloud',
          tenantId: 'XXXX-tenant-id-XXXX',
          clientId: 'XXXX-client-id-XXXX',
        };

        // If `dataSourceSettings.authType === "clientsecret"` && `secureJsonFields.azureClientSecret == true`.
        const resultForClientSecretCredentials1 = updateCredentials(
          dataSourceSettingsWithClientSecretOnServer,
          configWithManagedIdentityDisabled,
          basicClientSecretCredentials
        );
        expect(resultForClientSecretCredentials1).toEqual({
          jsonData: {
            azureCredentials: { ...basicClientSecretCredentials },
          },
          secureJsonData: { azureClientSecret: undefined },
          secureJsonFields: { azureClientSecret: false },
        });

        // If `dataSourceSettings.authType === "clientsecret"` && `secureJsonFields.azureClientSecret == false`.
        const resultForClientSecretCredentials2 = updateCredentials(
          dataSourceSettingsWithClientSecretInSecureJSONData,
          configWithManagedIdentityDisabled,
          { ...basicClientSecretCredentials, clientSecret: 'XXXX-super-secret-secret-XXXX' }
        );
        expect(resultForClientSecretCredentials2).toEqual({
          jsonData: {
            azureCredentials: { ...basicClientSecretCredentials },
          },
          secureJsonData: { azureClientSecret: 'XXXX-super-secret-secret-XXXX' },
          secureJsonFields: { azureClientSecret: false },
        });
      });
    });
  });
});
