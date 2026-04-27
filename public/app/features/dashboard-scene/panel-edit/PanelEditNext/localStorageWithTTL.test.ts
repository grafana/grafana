import { store } from '@grafana/data/utils';

import { getLocalStorageWithTTL, setLocalStorageWithTTL } from './localStorageWithTTL';

const TEST_KEY = 'test.local-storage-with-ttl';

describe('localStorageWithTTL', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    store.delete(TEST_KEY);
    jest.useRealTimers();
  });

  describe('getLocalStorageWithTTL', () => {
    it('should return null for a missing key', () => {
      expect(getLocalStorageWithTTL<string>(TEST_KEY)).toBeNull();
    });

    it('should not call store.delete for a missing key', () => {
      const deleteSpy = jest.spyOn(store, 'delete');
      getLocalStorageWithTTL<string>(TEST_KEY);
      expect(deleteSpy).not.toHaveBeenCalled();
      deleteSpy.mockRestore();
    });

    it('should return null and delete key when entry is expired', () => {
      setLocalStorageWithTTL(TEST_KEY, 'value');

      // Advance past the default 1-week TTL
      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      jest.advanceTimersByTime(ONE_WEEK_MS + 1);

      const deleteSpy = jest.spyOn(store, 'delete');
      expect(getLocalStorageWithTTL<string>(TEST_KEY)).toBeNull();
      expect(deleteSpy).toHaveBeenCalledWith(TEST_KEY);
      deleteSpy.mockRestore();
    });

    it('should return the value when entry is at exactly the TTL boundary', () => {
      setLocalStorageWithTTL(TEST_KEY, 'value');

      const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
      jest.advanceTimersByTime(ONE_WEEK_MS);

      // Exactly at boundary — isExpired uses strict >, so this should still be valid
      expect(getLocalStorageWithTTL<string>(TEST_KEY)).toBe('value');
    });

    it('should respect a custom TTL', () => {
      const CUSTOM_TTL = 5000;
      setLocalStorageWithTTL(TEST_KEY, 'value');

      jest.advanceTimersByTime(CUSTOM_TTL);
      expect(getLocalStorageWithTTL<string>(TEST_KEY, CUSTOM_TTL)).toBe('value');

      // Re-set because the previous get consumed the entry check
      setLocalStorageWithTTL(TEST_KEY, 'value');
      jest.advanceTimersByTime(CUSTOM_TTL + 1);
      expect(getLocalStorageWithTTL<string>(TEST_KEY, CUSTOM_TTL)).toBeNull();
    });

    it('should return null and delete key when stored data has no timestamp', () => {
      store.setObject(TEST_KEY, { value: 'hello' });

      const deleteSpy = jest.spyOn(store, 'delete');
      expect(getLocalStorageWithTTL<string>(TEST_KEY)).toBeNull();
      expect(deleteSpy).toHaveBeenCalledWith(TEST_KEY);
      deleteSpy.mockRestore();
    });

    it('should return null and delete key when stored data has non-numeric timestamp', () => {
      store.setObject(TEST_KEY, { value: 'hello', timestamp: 'not-a-number' });

      const deleteSpy = jest.spyOn(store, 'delete');
      expect(getLocalStorageWithTTL<string>(TEST_KEY)).toBeNull();
      expect(deleteSpy).toHaveBeenCalledWith(TEST_KEY);
      deleteSpy.mockRestore();
    });

    it('should log a console.error when store.setObject throws', () => {
      jest.spyOn(store, 'setObject').mockImplementation(() => {
        throw new Error('Test error');
      });
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      setLocalStorageWithTTL(TEST_KEY, 'value');

      expect(consoleSpy).toHaveBeenCalledWith('Failed to persist value with TTL', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });
});
