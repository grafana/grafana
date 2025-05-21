import {
  buildCacheHeaders,
  getDefaultCacheHeaders,
  isCancelledError,
  populateMatchParamsFromQueries,
  removeQuotesIfExist,
} from './lang_provider_shared';
import { PrometheusCacheLevel, PromQuery } from './types';

describe('lang provider shared', () => {
  describe('isCancelledError', () => {
    it('should return true for cancelled errors', () => {
      expect(isCancelledError({ cancelled: true })).toBe(true);
    });

    it('should return false for other errors', () => {
      expect(isCancelledError(new Error('test'))).toBe(false);
      expect(isCancelledError({ message: 'error' })).toBe(false);
      expect(isCancelledError(null)).toBe(false);
      expect(isCancelledError(undefined)).toBe(false);
    });
  });

  describe('removeQuotesIfExist', () => {
    it('should remove quotes from quoted strings', () => {
      expect(removeQuotesIfExist('"test"')).toBe('test');
    });

    it('should leave unquoted strings unchanged', () => {
      expect(removeQuotesIfExist('test')).toBe('test');
      expect(removeQuotesIfExist('test"')).toBe('test"');
      expect(removeQuotesIfExist('"test')).toBe('"test');
    });
  });

  describe('buildCacheHeaders', () => {
    it('should build correct cache headers', () => {
      const result = buildCacheHeaders(300);
      expect(result).toEqual({
        headers: {
          'X-Grafana-Cache': 'private, max-age=300',
        },
      });
    });
  });

  describe('getDefaultCacheHeaders', () => {
    it('should return cache headers for non-None cache levels', () => {
      const result = getDefaultCacheHeaders(PrometheusCacheLevel.Low);
      expect(result).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Grafana-Cache': expect.stringContaining('private, max-age='),
          }),
        })
      );
    });

    it('should return undefined for None cache level', () => {
      const result = getDefaultCacheHeaders(PrometheusCacheLevel.None);
      expect(result).toBeUndefined();
    });
  });

  describe('populateMatchParamsFromQueries', () => {
    it('should add match params from queries', () => {
      const initialParams = new URLSearchParams();
      const queries: PromQuery[] = [
        { expr: 'metric1', refId: '1' },
        { expr: 'metric2', refId: '2' },
      ];

      const result = populateMatchParamsFromQueries(initialParams, queries);

      const matches = Array.from(result.getAll('match[]'));
      expect(matches).toContain('metric1');
      expect(matches).toContain('metric2');
    });

    it('should handle binary queries', () => {
      const initialParams = new URLSearchParams();
      const queries: PromQuery[] = [{ expr: 'binary{label="val"} + second{}', refId: '1' }];

      const result = populateMatchParamsFromQueries(initialParams, queries);

      const matches = Array.from(result.getAll('match[]'));
      expect(matches).toContain('binary');
      expect(matches).toContain('second');
    });

    it('should handle undefined queries', () => {
      const initialParams = new URLSearchParams({ param: 'value' });

      const result = populateMatchParamsFromQueries(initialParams, undefined);

      expect(result.toString()).toBe('param=value');
    });

    it('should handle UTF8 metrics', () => {
      // Using the mocked isValidLegacyName function from jest.mock setup
      const initialParams = new URLSearchParams();
      const queries: PromQuery[] = [{ expr: '{"utf8.metric", label="value"}', refId: '1' }];

      const result = populateMatchParamsFromQueries(initialParams, queries);

      const matches = Array.from(result.getAll('match[]'));
      expect(matches).toContain('{"utf8.metric"}');
    });
  });
});
