import { PrometheusCacheLevel } from './types';

/**
 * Returns the debounce time in milliseconds based on the cache level.
 * Used to control the frequency of API requests.
 *
 * @param {PrometheusCacheLevel} cacheLevel - The cache level (None, Low, Medium, High)
 * @returns {number} Debounce time in milliseconds:
 *   - Medium: 600ms
 *   - High: 1200ms
 *   - Default (None/Low): 350ms
 */
export const getDebounceTimeInMilliseconds = (cacheLevel: PrometheusCacheLevel): number => {
  switch (cacheLevel) {
    case PrometheusCacheLevel.Medium:
      return 600;
    case PrometheusCacheLevel.High:
      return 1200;
    default:
      return 350;
  }
};

/**
 * Returns the number of days to cache metadata based on the cache level.
 * Used for caching Prometheus metric metadata.
 *
 * @param {PrometheusCacheLevel} cacheLevel - The cache level (None, Low, Medium, High)
 * @returns {number} Number of days to cache:
 *   - Medium: 7 days
 *   - High: 30 days
 *   - Default (None/Low): 1 day
 */
export const getDaysToCacheMetadata = (cacheLevel: PrometheusCacheLevel): number => {
  switch (cacheLevel) {
    case PrometheusCacheLevel.Medium:
      return 7;
    case PrometheusCacheLevel.High:
      return 30;
    default:
      return 1;
  }
};

/**
 * Returns the cache duration in minutes based on the cache level.
 * Used for general API response caching.
 *
 * @param {PrometheusCacheLevel} cacheLevel - The cache level (None, Low, Medium, High)
 * @returns Cache duration in minutes:
 *   - Medium: 10 minutes
 *   - High: 60 minutes
 *   - Default (None/Low): 1 minute
 */
export const getCacheDurationInMinutes = (cacheLevel: PrometheusCacheLevel) => {
  switch (cacheLevel) {
    case PrometheusCacheLevel.Medium:
      return 10;
    case PrometheusCacheLevel.High:
      return 60;
    default:
      return 1;
  }
};

/**
 * Builds cache headers for Prometheus API requests.
 * Creates a standard cache control header with private scope and max-age directive.
 *
 * @param {number} durationInSeconds - Cache duration in seconds
 * @returns Object containing headers with cache control directives:
 *   - X-Grafana-Cache: private, max-age=<duration>
 * @example
 * // Returns { headers: { 'X-Grafana-Cache': 'private, max-age=300' } }
 * buildCacheHeaders(300)
 */
export const buildCacheHeaders = (durationInSeconds: number) => {
  return {
    headers: {
      'X-Grafana-Cache': `private, max-age=${durationInSeconds}`,
    },
  };
};

/**
 * Gets appropriate cache headers based on the configured cache level.
 * Converts cache duration from minutes to seconds and builds the headers.
 * Returns undefined if caching is disabled (None level).
 *
 * @param {PrometheusCacheLevel} cacheLevel - Cache level (None, Low, Medium, High)
 * @returns Cache headers object or undefined if caching is disabled
 * @example
 * // For Medium level, returns { headers: { 'X-Grafana-Cache': 'private, max-age=600' } }
 * getDefaultCacheHeaders(PrometheusCacheLevel.Medium)
 */
export const getDefaultCacheHeaders = (cacheLevel: PrometheusCacheLevel) => {
  if (cacheLevel !== PrometheusCacheLevel.None) {
    return buildCacheHeaders(getCacheDurationInMinutes(cacheLevel) * 60);
  }
  return;
};
