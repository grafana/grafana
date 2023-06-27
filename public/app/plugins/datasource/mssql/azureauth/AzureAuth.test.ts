import { DataSourceSettings } from '@grafana/data';
import { GrafanaBootConfig } from '@grafana/runtime';

import { ConcealedSecret, AzureAuthSecureJSONDataType } from '../types';

import { getDefaultAzureCloud, getDefaultCredentials, getSecret } from './AzureCredentialsConfig';

describe('AzureAuth', () => {
  describe('AzureCredentialsConfig', () => {
    it('`getDefaultAzureCloud()` should return the correct cloud', () => {
      const configWithDefinedCloud: GrafanaBootConfig = {
        azure: { cloud: 'AzureCloud' },
      } as unknown as GrafanaBootConfig;
      const configWithUndefinedCloud: GrafanaBootConfig = { azure: {} } as unknown as GrafanaBootConfig;

      const resultForDefinedCloud = getDefaultAzureCloud(configWithDefinedCloud);
      const resultForUndefinedCloud = getDefaultAzureCloud(configWithUndefinedCloud);

      // Currently, the only supported cloud is AzureCloud, so we expect the same result for both defined and undefined cases.
      expect(resultForDefinedCloud).toBe('AzureCloud');
      expect(resultForUndefinedCloud).toBe('AzureCloud');
    });

    it('`getDefaultCredentials()` should return the correct credentials based on whether the managed identity is enabled', () => {
      const configWithManagedIdentityEnabled: GrafanaBootConfig = {
        azure: { managedIdentityEnabled: true },
      } as unknown as GrafanaBootConfig;
      const configWithManagedIdentityDisabled: GrafanaBootConfig = {
        azure: { managedIdentityEnabled: false },
      } as unknown as GrafanaBootConfig;

      const resultForManagedIdentityEnabled = getDefaultCredentials(configWithManagedIdentityEnabled);
      const resultForManagedIdentityDisabled = getDefaultCredentials(configWithManagedIdentityDisabled);

      expect(resultForManagedIdentityEnabled).toEqual({ authType: 'msi' });
      expect(resultForManagedIdentityDisabled).toEqual({ authType: 'clientsecret', azureCloud: 'AzureCloud' });
    });

    it("`getSecret()` should correctly return the client secret if it's not concealed", () => {
      const concealed: ConcealedSecret = Symbol('superSecretSecret');
      const dataSourceSettingsServerSideSecret: DataSourceSettings<{}, AzureAuthSecureJSONDataType> = {
        secureJsonFields: { azureClientSecret: true },
      } as unknown as DataSourceSettings<{}, AzureAuthSecureJSONDataType>;
      const dataSourceSettingsSecureJSONDataSecret: DataSourceSettings<{}, AzureAuthSecureJSONDataType> = {
        secureJsonFields: { azureClientSecret: false },
        secureJsonData: { azureClientSecret: 'XXXX-super-secret-secret-XXXX' },
      } as unknown as DataSourceSettings<{}, AzureAuthSecureJSONDataType>;

      const resultFromServerSideSecret = getSecret(dataSourceSettingsServerSideSecret, concealed);
      expect(resultFromServerSideSecret).toBe(concealed);

      const resultFromSecureJSONDataSecret = getSecret(dataSourceSettingsSecureJSONDataSecret, concealed);
      expect(resultFromSecureJSONDataSecret).toBe('XXXX-super-secret-secret-XXXX');
    });
  });
});
