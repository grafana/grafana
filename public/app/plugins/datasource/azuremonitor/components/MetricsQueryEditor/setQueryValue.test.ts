import { setCustomNamespace } from './setQueryValue';

describe('setQueryValue', () => {
  describe('setCustomNamespace', () => {
    it('The metricnamespace must be: microsoft.storage/storageaccounts for storage accounts.', () => {
      const result = setCustomNamespace({ refId: 'A' }, 'microsoft.storage/storageaccounts/fileservices');
      expect(result.azureMonitor?.customNamespace).toBeUndefined();
      expect(result.azureMonitor?.metricNamespace).toEqual('microsoft.storage/storageaccounts/fileservices');
    });

    it('Set a custom namespace for non storage accounts.', () => {
      const result = setCustomNamespace({ refId: 'A' }, 'foo/bar');
      expect(result.azureMonitor?.customNamespace).toEqual('foo/bar');
    });
  });
});
