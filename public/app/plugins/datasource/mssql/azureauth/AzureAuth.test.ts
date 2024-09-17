import { AzureAuthType, AzureCloud, AzureCredentialsType, ConcealedSecretType } from '../types';

import {
  configWithManagedIdentityEnabled,
  configWithManagedIdentityDisabled,
  dataSourceSettingsWithMsiCredentials,
  dataSourceSettingsWithClientSecretOnServer,
  dataSourceSettingsWithClientSecretInSecureJSONData,
} from './AzureAuth.testMocks';
import { getDefaultCredentials, getSecret, getCredentials, updateCredentials } from './AzureCredentialsConfig';

// NOTE: @ts-ignores are used to ignore the type errors that are thrown when passing in the mocks.
// This is because the mocks are partials of the actual types, so the types are not complete.

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
      const resultFromServerSideSecret = getSecret(false, CLIENT_SECRET_STRING);
      expect(resultFromServerSideSecret).toBe(CLIENT_SECRET_STRING);

      const resultFromSecureJSONDataSecret = typeof getSecret(true, '');
      expect(resultFromSecureJSONDataSecret).toBe('symbol');
    });

    describe('getCredentials()', () => {
      it('should return the correct managed identity credentials', () => {
        // If `dataSourceSettings.authType === AzureAuthType.MSI` && `config.azure.managedIdentityEnabled === true`.
        const resultForManagedIdentityEnabled = getCredentials(
          // @ts-ignore
          dataSourceSettingsWithMsiCredentials,
          configWithManagedIdentityEnabled
        );
        expect(resultForManagedIdentityEnabled).toEqual({ authType: AzureAuthType.MSI });

        // If `dataSourceSettings.authType === AzureAuthType.MSI` but `config.azure.managedIdentityEnabled !== true`.
        // Default to basic client secret credentials.
        const resultForManagedIdentityEnabledInJSONButDisabledInConfig = getCredentials(
          // @ts-ignore
          dataSourceSettingsWithMsiCredentials,
          configWithManagedIdentityDisabled
        );
        expect(resultForManagedIdentityEnabledInJSONButDisabledInConfig).toEqual({
          authType: AzureAuthType.CLIENT_SECRET,
          azureCloud: 'AzureCloud',
        });
      });

      it('should return the correct client secret credentials', () => {
        const basicExpectedResult = {
          authType: AzureAuthType.CLIENT_SECRET,
          azureCloud: 'AzureCloud',
          tenantId: 'XXXX-tenant-id-XXXX',
          clientId: 'XXXX-client-id-XXXX',
        };

        // If `dataSourceSettings.authType === AzureAuthType.CLIENT_SECRET` && `secureJsonFields.azureClientSecret == true`,
        // i.e. the client secret is stored on the server.
        const resultForClientSecretCredentialsOnServer = getCredentials(
          // @ts-ignore
          dataSourceSettingsWithClientSecretOnServer,
          configWithManagedIdentityDisabled
        );

        // Here we test the properties separately because the client secret is a symbol,
        // and since JS symobls are unique, we test via the `typeof` operator.
        expect(resultForClientSecretCredentialsOnServer.authType).toEqual(AzureAuthType.CLIENT_SECRET);
        expect(resultForClientSecretCredentialsOnServer.azureCloud).toEqual('AzureCloud');
        expect(resultForClientSecretCredentialsOnServer.tenantId).toEqual('XXXX-tenant-id-XXXX');
        expect(resultForClientSecretCredentialsOnServer.clientId).toEqual('XXXX-client-id-XXXX');
        expect(typeof resultForClientSecretCredentialsOnServer.clientSecret).toEqual('symbol');

        //   If `dataSourceSettings.authType === AzureAuthType.CLIENT_SECRET` && `secureJsonFields.azureClientSecret == false`,
        //   i.e. the client secret is stored in the secureJson.
        const resultForClientSecretCredentialsInSecureJSON = getCredentials(
          // @ts-ignore
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
        // If `dataSourceSettings.authType === AzureAuthType.MSI` && `config.azure.managedIdentityEnabled === true`.
        const resultForMsiCredentials = updateCredentials(
          // @ts-ignore
          dataSourceSettingsWithMsiCredentials,
          configWithManagedIdentityEnabled,
          {
            authType: AzureAuthType.MSI,
          }
        );
        expect(resultForMsiCredentials).toEqual({ jsonData: { azureCredentials: { authType: 'msi' } } });

        // If `dataSourceSettings.authType === AzureAuthType.MSI` but `config.azure.managedIdentityEnabled !== true`.
        expect(() =>
          updateCredentials(
            // @ts-ignore
            dataSourceSettingsWithMsiCredentials,
            configWithManagedIdentityDisabled,
            {
              authType: AzureAuthType.MSI,
            }
          )
        ).toThrow('Managed Identity authentication is not enabled in Grafana config.');
      });

      it('should update the credentials for client secret correctly', () => {
        const basicClientSecretCredentials: AzureCredentialsType = {
          authType: AzureAuthType.CLIENT_SECRET,
          azureCloud: 'AzureCloud',
          tenantId: 'XXXX-tenant-id-XXXX',
          clientId: 'XXXX-client-id-XXXX',
        };

        // If `dataSourceSettings.authType === AzureAuthType.CLIENT_SECRET` && `secureJsonFields.azureClientSecret == true`.
        const resultForClientSecretCredentials1 = updateCredentials(
          // @ts-ignore
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

        // If `dataSourceSettings.authType === AzureAuthType.CLIENT_SECRET` && `secureJsonFields.azureClientSecret == false`.
        const resultForClientSecretCredentials2 = updateCredentials(
          // @ts-ignore
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
