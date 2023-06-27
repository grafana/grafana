import { GrafanaBootConfig } from '@grafana/runtime';

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

    it("`getSecret()` should correctly return the client secret if it's not concealed", () => {});
  });
});
