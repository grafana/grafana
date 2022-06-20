import { ApiKeysState } from 'app/types';

import { getMultipleMockKeys } from '../__mocks__/apiKeysMock';

import { getApiKeys, getApiKeysCount, getIncludeExpired, getIncludeExpiredDisabled } from './selectors';

describe('API Keys selectors', () => {
  const mockKeys = getMultipleMockKeys(5);
  const mockKeysIncludingExpired = getMultipleMockKeys(8);

  describe('getApiKeysCount', () => {
    it('returns the correct count when includeExpired is false', () => {
      const mockState: ApiKeysState = {
        keys: mockKeys,
        keysIncludingExpired: mockKeysIncludingExpired,
        searchQuery: '',
        hasFetched: true,
        includeExpired: false,
        apiKeysMigrated: false,
      };
      const keyCount = getApiKeysCount(mockState);
      expect(keyCount).toBe(5);
    });

    it('returns the correct count when includeExpired is true', () => {
      const mockState: ApiKeysState = {
        keys: mockKeys,
        keysIncludingExpired: mockKeysIncludingExpired,
        searchQuery: '',
        hasFetched: true,
        includeExpired: true,
        apiKeysMigrated: false,
      };
      const keyCount = getApiKeysCount(mockState);
      expect(keyCount).toBe(8);
    });
  });

  describe('getApiKeys', () => {
    describe('when includeExpired is false', () => {
      it('should return all keys if no search query', () => {
        const mockState: ApiKeysState = {
          keys: mockKeys,
          keysIncludingExpired: mockKeysIncludingExpired,
          searchQuery: '',
          hasFetched: true,
          includeExpired: false,
          apiKeysMigrated: false,
        };
        const keys = getApiKeys(mockState);
        expect(keys).toEqual(mockKeys);
      });

      it('should filter keys if search query exists', () => {
        const mockState: ApiKeysState = {
          keys: mockKeys,
          keysIncludingExpired: mockKeysIncludingExpired,
          searchQuery: '5',
          hasFetched: true,
          includeExpired: false,
          apiKeysMigrated: false,
        };
        const keys = getApiKeys(mockState);
        expect(keys.length).toEqual(1);
      });
    });

    describe('when includeExpired is true', () => {
      it('should return all keys if no search query', () => {
        const mockState: ApiKeysState = {
          keys: mockKeys,
          keysIncludingExpired: mockKeysIncludingExpired,
          searchQuery: '',
          hasFetched: true,
          includeExpired: true,
          apiKeysMigrated: false,
        };
        const keys = getApiKeys(mockState);
        expect(keys).toEqual(mockKeysIncludingExpired);
      });

      it('should filter keys if search query exists', () => {
        const mockState: ApiKeysState = {
          keys: mockKeys,
          keysIncludingExpired: mockKeysIncludingExpired,
          searchQuery: '5',
          hasFetched: true,
          includeExpired: true,
          apiKeysMigrated: false,
        };
        const keys = getApiKeys(mockState);
        expect(keys.length).toEqual(1);
      });
    });
  });

  describe('getIncludeExpired', () => {
    it('returns true if includeExpired is true', () => {
      const mockState: ApiKeysState = {
        keys: mockKeys,
        keysIncludingExpired: mockKeysIncludingExpired,
        searchQuery: '',
        hasFetched: true,
        includeExpired: true,
        apiKeysMigrated: false,
      };
      const includeExpired = getIncludeExpired(mockState);
      expect(includeExpired).toBe(true);
    });

    it('returns false if includeExpired is false', () => {
      const mockState: ApiKeysState = {
        keys: mockKeys,
        keysIncludingExpired: mockKeysIncludingExpired,
        searchQuery: '',
        hasFetched: true,
        includeExpired: false,
        apiKeysMigrated: false,
      };
      const includeExpired = getIncludeExpired(mockState);
      expect(includeExpired).toBe(false);
    });
  });

  describe('getIncludeExpiredDisabled', () => {
    it('returns true if there are no active keys but there are expired keys', () => {
      const mockState: ApiKeysState = {
        keys: [],
        keysIncludingExpired: mockKeysIncludingExpired,
        searchQuery: '',
        hasFetched: true,
        includeExpired: true,
        apiKeysMigrated: false,
      };
      const includeExpiredDisabled = getIncludeExpiredDisabled(mockState);
      expect(includeExpiredDisabled).toBe(true);
    });

    it('returns false otherwise', () => {
      const mockState: ApiKeysState = {
        keys: mockKeys,
        keysIncludingExpired: mockKeysIncludingExpired,
        searchQuery: '',
        hasFetched: true,
        includeExpired: false,
        apiKeysMigrated: false,
      };
      const includeExpiredDisabled = getIncludeExpired(mockState);
      expect(includeExpiredDisabled).toBe(false);
    });
  });
});
