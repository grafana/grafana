import { isChunkError } from './SafeDynamicImport';

describe('isChunkError', () => {
  describe('when called with a loading chunk error', () => {
    it('then it should return true', () => {
      expect(isChunkError({ message: 'Loading chunk Monkey failed', name: '' })).toBe(true);
    });
  });

  describe('when called without a loading chunk error', () => {
    it('then it should return false', () => {
      expect(isChunkError({ message: 'AlertRuleList failed.', name: '' })).toBe(false);
    });
  });

  describe('when called without an error', () => {
    it('then it should return false', () => {
      expect(isChunkError(undefined)).toBe(false);
    });
  });

  describe('when called without a message', () => {
    it('then it should return false', () => {
      expect(isChunkError({} as Error)).toBe(false);
    });
  });
});
