import { credentialsDiffer } from './credentials';
import { AzureClientSecretCredentials } from './types';

describe('credentialsDiffer', () => {
  const defaultLogsCreds = {
    authType: 'clientsecret',
    logAnalyticsClientId: 'a',
    logAnalyticsTenantId: 'b',
    logAnalyticsClientSecret: 'c',
  };
  const defaultPrimaryCreds = { authType: 'clientsecret', clientId: 'a', tenantId: 'b', clientSecret: 'c' };
  [
    {
      description: 'Same credentials',
      logsCreds: { ...defaultLogsCreds },
      primaryCreds: { ...defaultPrimaryCreds },
      differ: false,
    },
    {
      description: 'different clientIDs',
      logsCreds: { ...defaultLogsCreds, logAnalyticsClientId: 'aa' },
      primaryCreds: { ...defaultPrimaryCreds },
      differ: true,
    },
    {
      description: 'different tenantID',
      logsCreds: { ...defaultLogsCreds, logAnalyticsTenantId: 'bb' },
      primaryCreds: { ...defaultPrimaryCreds },
      differ: true,
    },
    {
      description: 'different clientSecret',
      logsCreds: { ...defaultLogsCreds, logAnalyticsClientSecret: 'cc' },
      primaryCreds: { ...defaultPrimaryCreds },
      differ: true,
    },
  ].forEach((test) => {
    it(test.description, () => {
      expect(
        credentialsDiffer(
          test.logsCreds as AzureClientSecretCredentials,
          test.primaryCreds as AzureClientSecretCredentials
        )
      ).toBe(test.differ);
    });
  });
});
