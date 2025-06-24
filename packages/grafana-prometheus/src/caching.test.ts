import {
  getCacheDurationInMinutes,
  getDaysToCacheMetadata,
  getDebounceTimeInMilliseconds,
  buildCacheHeaders,
  getDefaultCacheHeaders,
} from './caching';
import { PrometheusCacheLevel } from './types';

describe('caching', () => {
  describe('getDebounceTimeInMilliseconds', () => {
    it('should return 600ms for Medium cache level', () => {
      expect(getDebounceTimeInMilliseconds(PrometheusCacheLevel.Medium)).toBe(600);
    });

    it('should return 1200ms for High cache level', () => {
      expect(getDebounceTimeInMilliseconds(PrometheusCacheLevel.High)).toBe(1200);
    });

    it('should return 350ms for Low cache level', () => {
      expect(getDebounceTimeInMilliseconds(PrometheusCacheLevel.Low)).toBe(350);
    });

    it('should return 350ms for None cache level', () => {
      expect(getDebounceTimeInMilliseconds(PrometheusCacheLevel.None)).toBe(350);
    });

    it('should return default value (350ms) for unknown cache level', () => {
      expect(getDebounceTimeInMilliseconds('invalid' as PrometheusCacheLevel)).toBe(350);
    });
  });

  describe('getDaysToCacheMetadata', () => {
    it('should return 7 days for Medium cache level', () => {
      expect(getDaysToCacheMetadata(PrometheusCacheLevel.Medium)).toBe(7);
    });

    it('should return 30 days for High cache level', () => {
      expect(getDaysToCacheMetadata(PrometheusCacheLevel.High)).toBe(30);
    });

    it('should return 1 day for Low cache level', () => {
      expect(getDaysToCacheMetadata(PrometheusCacheLevel.Low)).toBe(1);
    });

    it('should return 1 day for None cache level', () => {
      expect(getDaysToCacheMetadata(PrometheusCacheLevel.None)).toBe(1);
    });

    it('should return default value (1 day) for unknown cache level', () => {
      expect(getDaysToCacheMetadata('invalid' as PrometheusCacheLevel)).toBe(1);
    });
  });

  describe('getCacheDurationInMinutes', () => {
    it('should return 10 minutes for Medium cache level', () => {
      expect(getCacheDurationInMinutes(PrometheusCacheLevel.Medium)).toBe(10);
    });

    it('should return 60 minutes for High cache level', () => {
      expect(getCacheDurationInMinutes(PrometheusCacheLevel.High)).toBe(60);
    });

    it('should return 1 minute for Low cache level', () => {
      expect(getCacheDurationInMinutes(PrometheusCacheLevel.Low)).toBe(1);
    });

    it('should return 1 minute for None cache level', () => {
      expect(getCacheDurationInMinutes(PrometheusCacheLevel.None)).toBe(1);
    });

    it('should return default value (1 minute) for unknown cache level', () => {
      expect(getCacheDurationInMinutes('invalid' as PrometheusCacheLevel)).toBe(1);
    });
  });

  describe('buildCacheHeaders', () => {
    it('should build cache headers with provided duration in seconds', () => {
      const result = buildCacheHeaders(300);
      expect(result).toEqual({
        headers: {
          'X-Grafana-Cache': 'private, max-age=300',
        },
      });
    });

    it('should handle zero duration', () => {
      const result = buildCacheHeaders(0);
      expect(result).toEqual({
        headers: {
          'X-Grafana-Cache': 'private, max-age=0',
        },
      });
    });

    it('should handle large duration values', () => {
      const oneDayInSeconds = 86400;
      const result = buildCacheHeaders(oneDayInSeconds);
      expect(result).toEqual({
        headers: {
          'X-Grafana-Cache': 'private, max-age=86400',
        },
      });
    });
  });

  describe('getDefaultCacheHeaders', () => {
    it('should return cache headers for Medium cache level', () => {
      const result = getDefaultCacheHeaders(PrometheusCacheLevel.Medium);
      expect(result).toEqual({
        headers: {
          'X-Grafana-Cache': 'private, max-age=600', // 10 minutes in seconds
        },
      });
    });

    it('should return cache headers for High cache level', () => {
      const result = getDefaultCacheHeaders(PrometheusCacheLevel.High);
      expect(result).toEqual({
        headers: {
          'X-Grafana-Cache': 'private, max-age=3600', // 60 minutes in seconds
        },
      });
    });

    it('should return cache headers for Low cache level', () => {
      const result = getDefaultCacheHeaders(PrometheusCacheLevel.Low);
      expect(result).toEqual({
        headers: {
          'X-Grafana-Cache': 'private, max-age=60', // 1 minute in seconds
        },
      });
    });

    it('should return undefined for None cache level', () => {
      const result = getDefaultCacheHeaders(PrometheusCacheLevel.None);
      expect(result).toBeUndefined();
    });

    it('should handle unknown cache level as default (1 minute)', () => {
      const result = getDefaultCacheHeaders('invalid' as PrometheusCacheLevel);
      expect(result).toEqual({
        headers: {
          'X-Grafana-Cache': 'private, max-age=60', // 1 minute in seconds
        },
      });
    });
  });
});
