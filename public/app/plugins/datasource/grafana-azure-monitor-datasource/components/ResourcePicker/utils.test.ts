import { parseResourceURI } from './utils';

describe('AzureMonitor ResourcePicker utils', () => {
  describe('parseResourceURI', () => {
    it('should parse subscription URIs', () => {
      expect(parseResourceURI('/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572')).toEqual({
        subscriptionID: '44693801-6ee6-49de-9b2d-9106972f9572',
      });
    });

    it('should parse resource group URIs', () => {
      expect(
        parseResourceURI('/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources')
      ).toEqual({
        subscriptionID: '44693801-6ee6-49de-9b2d-9106972f9572',
        resourceGroup: 'cloud-datasources',
      });
    });

    it('should parse resource URIs', () => {
      expect(
        parseResourceURI(
          '/subscriptions/44693801-6ee6-49de-9b2d-9106972f9572/resourceGroups/cloud-datasources/providers/Microsoft.Compute/virtualMachines/GithubTestDataVM'
        )
      ).toEqual({
        subscriptionID: '44693801-6ee6-49de-9b2d-9106972f9572',
        resourceGroup: 'cloud-datasources',
        resource: 'GithubTestDataVM',
      });
    });

    it('returns undefined for invalid input', () => {
      expect(parseResourceURI('44693801-6ee6-49de-9b2d-9106972f9572')).toBeUndefined();
    });
  });
});
