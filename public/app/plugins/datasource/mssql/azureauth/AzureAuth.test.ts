import {
  AzureCredentials,
  AzureCloud,
  ConcealedSecret,
  AzureClientSecretCredentials,
  instanceOfAzureCredential,
  updateDatasourceCredentials,
} from '@grafana/azure-sdk';
import { config } from '@grafana/runtime';

import {
  dataSourceSettingsWithMsiCredentials,
  dataSourceSettingsWithClientSecretOnServer,
  dataSourceSettingsWithClientSecretInSecureJSONData,
} from './AzureAuth.testMocks';
import { getDefaultCredentials, getCredentials } from './AzureCredentialsConfig';

// NOTE: @ts-ignores are used to ignore the type errors that are thrown when passing in the mocks.
// This is because the mocks are partials of the actual types, so the types are not complete.

export const CLIENT_SECRET_SYMBOL: ConcealedSecret = Symbol('Concealed client secret');

export const CLIENT_SECRET_STRING = 'XXXX-super-secret-secret-XXXX';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'), // Keep the rest of the actual module
}));

describe('AzureAuth', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  describe('AzureCredentialsConfig', () => {
    it('`getDefaultCredentials()` should return the correct credentials based on whether the managed identity is enabled', () => {
      jest.mocked(config).azure.managedIdentityEnabled = true;
      const resultForManagedIdentityEnabled = getDefaultCredentials();

      jest.mocked(config).azure.managedIdentityEnabled = false;
      const resultForManagedIdentityDisabled = getDefaultCredentials();

      expect(resultForManagedIdentityEnabled).toEqual({ authType: 'msi' });
      expect(resultForManagedIdentityDisabled).toEqual({ authType: 'clientsecret', azureCloud: 'AzureCloud' });
    });

    describe('getCredentials()', () => {
      it('should return the correct managed identity credentials', () => {
        // If `dataSourceSettings.authType === 'msi'` && `config.azure.managedIdentityEnabled === true`.
        jest.mocked(config).azure.managedIdentityEnabled = true;
        const resultForManagedIdentityEnabled = getCredentials(
          // @ts-ignore
          dataSourceSettingsWithMsiCredentials
        );
        expect(resultForManagedIdentityEnabled).toEqual({ authType: 'msi' });

        // If `dataSourceSettings.authType === 'msi'` but `config.azure.managedIdentityEnabled !== true`.
        // Default to basic client secret credentials.
        jest.mocked(config).azure.managedIdentityEnabled = false;
        const resultForManagedIdentityEnabledInJSONButDisabledInConfig = getCredentials(
          // @ts-ignore
          dataSourceSettingsWithMsiCredentials
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

        // If `dataSourceSettings.authType === 'clientsecret'` && `secureJsonFields.azureClientSecret == true`,
        // i.e. the client secret is stored on the server.
        jest.mocked(config).azure.managedIdentityEnabled = false;
        const resultForClientSecretCredentialsOnServer = getCredentials(
          // @ts-ignore
          dataSourceSettingsWithClientSecretOnServer
        );

        // Here we test the properties separately because the client secret is a symbol,
        // and since JS symobls are unique, we test via the `typeof` operator.
        expect(resultForClientSecretCredentialsOnServer.authType).toEqual('clientsecret');
        expect(
          instanceOfAzureCredential<AzureClientSecretCredentials>(
            'clientsecret',
            resultForClientSecretCredentialsOnServer
          )
        ).toEqual(true);
        expect((resultForClientSecretCredentialsOnServer as AzureClientSecretCredentials).azureCloud).toEqual(
          'AzureCloud'
        );
        expect((resultForClientSecretCredentialsOnServer as AzureClientSecretCredentials).tenantId).toEqual(
          'XXXX-tenant-id-XXXX'
        );
        expect((resultForClientSecretCredentialsOnServer as AzureClientSecretCredentials).clientId).toEqual(
          'XXXX-client-id-XXXX'
        );
        expect(typeof (resultForClientSecretCredentialsOnServer as AzureClientSecretCredentials).clientSecret).toEqual(
          'symbol'
        );

        //   If `dataSourceSettings.authType === 'clientsecret'` && `secureJsonFields.azureClientSecret == false`,
        //   i.e. the client secret is stored in the secureJson.
        jest.mocked(config).azure.managedIdentityEnabled = false;
        const resultForClientSecretCredentialsInSecureJSON = getCredentials(
          // @ts-ignore
          dataSourceSettingsWithClientSecretInSecureJSONData
        );
        expect(resultForClientSecretCredentialsInSecureJSON).toEqual({
          ...basicExpectedResult,
          clientSecret: CLIENT_SECRET_STRING,
        });
      });
    });

    describe('updateCredentials()', () => {
      it('should update the credentials for managed service identity correctly', () => {
        // If `dataSourceSettings.authType === 'msi'` && `config.azure.managedIdentityEnabled === true`.
        jest.mocked(config).azure.managedIdentityEnabled = true;
        const resultForMsiCredentials = updateDatasourceCredentials(
          // @ts-ignore
          dataSourceSettingsWithMsiCredentials,
          {
            authType: 'msi',
          }
        );
        expect(resultForMsiCredentials).toEqual({ jsonData: { azureCredentials: { authType: 'msi' } } });

        // If `dataSourceSettings.authType === 'msi'` but `config.azure.managedIdentityEnabled !== true`.
        jest.mocked(config).azure.managedIdentityEnabled = false;
        expect(() =>
          updateDatasourceCredentials(
            // @ts-ignore
            dataSourceSettingsWithMsiCredentials,
            {
              authType: 'msi',
            }
          )
        ).toThrow('Managed Identity authentication is not enabled in Grafana config.');
      });

      it('should update the credentials for client secret correctly', () => {
        const basicClientSecretCredentials: AzureCredentials = {
          authType: 'clientsecret',
          azureCloud: AzureCloud.Public,
          tenantId: 'XXXX-tenant-id-XXXX',
          clientId: 'XXXX-client-id-XXXX',
        };

        // If `dataSourceSettings.authType === 'clientsecret'` && `secureJsonFields.azureClientSecret == true`.
        jest.mocked(config).azure.managedIdentityEnabled = false;
        const resultForClientSecretCredentials1 = updateDatasourceCredentials(
          // @ts-ignore
          dataSourceSettingsWithClientSecretOnServer,
          basicClientSecretCredentials
        );

        expect(resultForClientSecretCredentials1.jsonData.azureCredentials).toEqual(basicClientSecretCredentials);
        expect(resultForClientSecretCredentials1.secureJsonData).toEqual({ azureClientSecret: undefined });
        expect(resultForClientSecretCredentials1.secureJsonFields).toEqual({
          azureClientSecret: false,
          clientSecret: false,
        });

        // If `dataSourceSettings.authType === 'clientsecret'` && `secureJsonFields.azureClientSecret == false`.
        jest.mocked(config).azure.managedIdentityEnabled = false;
        const resultForClientSecretCredentials2 = updateDatasourceCredentials(
          // @ts-ignore
          dataSourceSettingsWithClientSecretInSecureJSONData,
          { ...basicClientSecretCredentials, clientSecret: 'XXXX-super-secret-secret-XXXX' }
        );

        expect(resultForClientSecretCredentials2.jsonData.azureCredentials).toEqual(basicClientSecretCredentials);
        expect(resultForClientSecretCredentials2.secureJsonData).toEqual({
          azureClientSecret: 'XXXX-super-secret-secret-XXXX',
        });
        expect(resultForClientSecretCredentials2.secureJsonFields).toEqual({
          azureClientSecret: false,
          clientSecret: false,
        });
      });
    });
  });
});
