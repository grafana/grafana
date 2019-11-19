import { getApiKeys } from './selectors';
import { getMultipleMockKeys } from '../__mocks__/apiKeysMock';
import { ApiKeysState } from 'app/types';

describe('API Keys selectors', () => {
  describe('Get API Keys', () => {
    const mockKeys = getMultipleMockKeys(5);

    it('should return all keys if no search query', () => {
      const mockState: ApiKeysState = { keys: mockKeys, searchQuery: '', hasFetched: false, includeExpired: false };

      const keys = getApiKeys(mockState);

      expect(keys).toEqual(mockKeys);
    });

    it('should filter keys if search query exists', () => {
      const mockState: ApiKeysState = { keys: mockKeys, searchQuery: '5', hasFetched: false, includeExpired: false };

      const keys = getApiKeys(mockState);

      expect(keys.length).toEqual(1);
    });
  });
});
