import { TimeRange } from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime';

import { getDefaultCacheHeaders } from './caching';
import { DEFAULT_SERIES_LIMIT, EMPTY_SELECTOR, MATCH_ALL_LABELS, METRIC_LABEL } from './constants';
import { PrometheusDatasource } from './datasource';
import { getRangeSnapInterval, processHistogramMetrics, removeQuotesIfExist } from './language_utils';
import { buildVisualQueryFromString } from './querybuilder/parsing';
import { PrometheusCacheLevel } from './types';
import { escapeForUtf8Support, utf8Support } from './utf8_support';

type PrometheusSeriesResponse = Array<{ [key: string]: string }>;
type PrometheusLabelsResponse = string[];

export interface ResourceApiClient {
  metrics: string[];
  histogramMetrics: string[];
  labelKeys: string[];
  cachedLabelValues: Record<string, string[]>;

  start: (timeRange: TimeRange) => Promise<void>;

  queryMetrics: (timeRange: TimeRange) => Promise<{ metrics: string[]; histogramMetrics: string[] }>;
  queryLabelKeys: (timeRange: TimeRange, match?: string, limit?: number) => Promise<string[]>;
  queryLabelValues: (timeRange: TimeRange, labelKey: string, match?: string, limit?: number) => Promise<string[]>;

  querySeries: (timeRange: TimeRange, match: string, limit: number) => Promise<PrometheusSeriesResponse>;
}

type RequestFn = (
  url: string,
  params?: Record<string, unknown>,
  options?: Partial<BackendSrvRequest>
) => Promise<unknown>;

export abstract class BaseResourceClient {
  private seriesLimit: number;

  constructor(
    protected readonly request: RequestFn,
    protected readonly datasource: PrometheusDatasource
  ) {
    this.seriesLimit = this.datasource.seriesLimit;
  }

  /**
   * Returns the effective limit to use for API requests.
   * Uses the provided limit if specified, otherwise falls back to the datasource's configured series limit.
   * When zero is provided, it returns zero (which means no limit in Prometheus API).
   *
   * @param {number} [limit] - Optional limit parameter from the API call
   * @returns {number} The limit to use - either the provided limit or datasource's default series limit
   */
  protected getEffectiveLimit(limit?: number): number {
    return limit ?? this.seriesLimit;
  }

  protected async requestLabels(
    url: string,
    params?: Record<string, unknown>,
    options?: Partial<BackendSrvRequest>
  ): Promise<PrometheusLabelsResponse> {
    const response = await this.request(url, params, options);
    return Array.isArray(response) ? response : [];
  }

  protected async requestSeries(
    url: string,
    params?: Record<string, unknown>,
    options?: Partial<BackendSrvRequest>
  ): Promise<PrometheusSeriesResponse> {
    const response = await this.request(url, params, options);
    return Array.isArray(response) ? response : [];
  }

  /**
   * Fetches all time series that match a specific label matcher using **series** endpoint.
   *
   * @param {TimeRange} timeRange - Time range to use for the query
   * @param {string} match - Label matcher to filter time series
   * @param {string} limit - Maximum number of series to return
   */
  public querySeries = async (timeRange: TimeRange, match: string | undefined, limit: number) => {
    const effectiveMatch = !match || match === EMPTY_SELECTOR ? MATCH_ALL_LABELS : match;
    const timeParams = this.datasource.getTimeRangeParams(timeRange);
    const searchParams = { ...timeParams, 'match[]': effectiveMatch, limit };
    return await this.requestSeries('/api/v1/series', searchParams, getDefaultCacheHeaders(this.datasource.cacheLevel));
  };
}

export class LabelsApiClient extends BaseResourceClient implements ResourceApiClient {
  private _cache: ResourceClientsCache = new ResourceClientsCache(this.datasource.cacheLevel);

  public histogramMetrics: string[] = [];
  public metrics: string[] = [];
  public labelKeys: string[] = [];
  public cachedLabelValues: Record<string, string[]> = {};

  start = async (timeRange: TimeRange) => {
    await this.queryMetrics(timeRange);
    this.labelKeys = await this.queryLabelKeys(timeRange);
  };

  /**
   * Fetches all available metrics from Prometheus using the labels values endpoint for __name__.
   * Also processes and identifies histogram metrics (those ending with '_bucket').
   * Results are cached and stored in the client instance for future use.
   *
   * @param {TimeRange} timeRange - Time range to search for metrics
   * @param {number} [limit] - Optional maximum number of metrics to return, uses datasource default if not specified
   * @returns {Promise<{metrics: string[], histogramMetrics: string[]}>} Object containing all metrics and filtered histogram metrics
   */
  public queryMetrics = async (
    timeRange: TimeRange,
    limit?: number
  ): Promise<{ metrics: string[]; histogramMetrics: string[] }> => {
    const effectiveLimit = this.getEffectiveLimit(limit);
    this.metrics = await this.queryLabelValues(timeRange, METRIC_LABEL, undefined, effectiveLimit);
    this.histogramMetrics = processHistogramMetrics(this.metrics);
    this._cache.setLabelValues(timeRange, undefined, effectiveLimit, this.metrics);
    return { metrics: this.metrics, histogramMetrics: this.histogramMetrics };
  };

  /**
   * Fetches all available label keys from Prometheus using labels endpoint.
   * Uses the labels endpoint with optional match parameter for filtering.
   *
   * @param {TimeRange} timeRange - Time range to use for the query
   * @param {string} match - Optional label matcher to filter results
   * @param {string} limit - Maximum number of results to return
   * @returns {Promise<string[]>} Array of label keys sorted alphabetically
   */
  public queryLabelKeys = async (timeRange: TimeRange, match?: string, limit?: number): Promise<string[]> => {
    let url = '/api/v1/labels';
    const timeParams = getRangeSnapInterval(this.datasource.cacheLevel, timeRange);
    const effectiveLimit = this.getEffectiveLimit(limit);
    const searchParams = { limit: effectiveLimit, ...timeParams, ...(match ? { 'match[]': match } : {}) };
    const effectiveMatch = match ?? '';
    const maybeCachedKeys = this._cache.getLabelKeys(timeRange, effectiveMatch, effectiveLimit);
    if (maybeCachedKeys) {
      return maybeCachedKeys;
    }

    const res = await this.requestLabels(url, searchParams, getDefaultCacheHeaders(this.datasource.cacheLevel));
    if (Array.isArray(res)) {
      this.labelKeys = res.slice().sort();
      this._cache.setLabelKeys(timeRange, effectiveMatch, effectiveLimit, this.labelKeys);
      return this.labelKeys.slice();
    }

    return [];
  };

  /**
   * Fetches all values for a specific label key from Prometheus using labels values endpoint.
   *
   * @param {TimeRange} timeRange - Time range to use for the query
   * @param {string} labelKey - The label key to fetch values for
   * @param {string} match - Optional label matcher to filter results
   * @param {string} limit - Maximum number of results to return
   * @returns {Promise<string[]>} Array of label values
   */
  public queryLabelValues = async (
    timeRange: TimeRange,
    labelKey: string,
    match?: string,
    limit?: number
  ): Promise<string[]> => {
    const timeParams = this.datasource.getAdjustedInterval(timeRange);
    const effectiveLimit = this.getEffectiveLimit(limit);
    const searchParams = { limit: effectiveLimit, ...timeParams, ...(match ? { 'match[]': match } : {}) };
    const interpolatedName = this.datasource.interpolateString(labelKey);
    const interpolatedAndEscapedName = escapeForUtf8Support(removeQuotesIfExist(interpolatedName));
    const effectiveMatch = `${match ?? ''}-${interpolatedAndEscapedName}`;
    const maybeCachedValues = this._cache.getLabelValues(timeRange, effectiveMatch, effectiveLimit);
    if (maybeCachedValues) {
      return maybeCachedValues;
    }

    const url = `/api/v1/label/${interpolatedAndEscapedName}/values`;
    const value = await this.requestLabels(url, searchParams, getDefaultCacheHeaders(this.datasource.cacheLevel));
    this._cache.setLabelValues(timeRange, effectiveMatch, effectiveLimit, value ?? []);
    return value ?? [];
  };
}

export class SeriesApiClient extends BaseResourceClient implements ResourceApiClient {
  private _cache: ResourceClientsCache = new ResourceClientsCache(this.datasource.cacheLevel);

  public histogramMetrics: string[] = [];
  public metrics: string[] = [];
  public labelKeys: string[] = [];
  public cachedLabelValues: Record<string, string[]> = {};

  start = async (timeRange: TimeRange) => {
    await this.queryMetrics(timeRange);
  };

  public queryMetrics = async (timeRange: TimeRange): Promise<{ metrics: string[]; histogramMetrics: string[] }> => {
    const series = await this.querySeries(timeRange, undefined, DEFAULT_SERIES_LIMIT);
    const { metrics, labelKeys } = processSeries(series, METRIC_LABEL);
    this.metrics = metrics;
    this.histogramMetrics = processHistogramMetrics(this.metrics);
    this.labelKeys = labelKeys;
    this._cache.setLabelValues(timeRange, undefined, DEFAULT_SERIES_LIMIT, metrics);
    this._cache.setLabelKeys(timeRange, undefined, DEFAULT_SERIES_LIMIT, labelKeys);
    return { metrics: this.metrics, histogramMetrics: this.histogramMetrics };
  };

  public queryLabelKeys = async (timeRange: TimeRange, match?: string, limit?: number): Promise<string[]> => {
    const effectiveLimit = this.getEffectiveLimit(limit);
    const effectiveMatch = !match || match === EMPTY_SELECTOR ? undefined : match;
    const maybeCachedKeys = this._cache.getLabelKeys(timeRange, effectiveMatch, effectiveLimit);
    if (maybeCachedKeys) {
      return maybeCachedKeys;
    }

    const series = await this.querySeries(timeRange, effectiveMatch, effectiveLimit);
    const { labelKeys } = processSeries(series);
    this._cache.setLabelKeys(timeRange, effectiveMatch, effectiveLimit, labelKeys);
    return labelKeys;
  };

  public queryLabelValues = async (
    timeRange: TimeRange,
    labelKey: string,
    match?: string,
    limit?: number
  ): Promise<string[]> => {
    let effectiveMatch = '';
    if (!match || match === EMPTY_SELECTOR) {
      // Just and empty matcher {} or no matcher
      effectiveMatch = `{${utf8Support(removeQuotesIfExist(labelKey))}!=""}`;
    } else {
      const {
        query: { metric, labels },
      } = buildVisualQueryFromString(match);
      labels.push({
        label: removeQuotesIfExist(labelKey),
        op: '!=',
        value: '',
      });
      const metricFilter = metric ? `__name__="${metric}",` : '';
      const labelFilters = labels.map((lf) => `${utf8Support(lf.label)}${lf.op}"${lf.value}"`).join(',');
      effectiveMatch = `{${metricFilter}${labelFilters}}`;
    }

    const effectiveLimit = this.getEffectiveLimit(limit);
    const maybeCachedValues = this._cache.getLabelValues(timeRange, effectiveMatch, effectiveLimit);
    if (maybeCachedValues) {
      return maybeCachedValues;
    }

    const series = await this.querySeries(timeRange, effectiveMatch, effectiveLimit);
    const { labelValues } = processSeries(series, removeQuotesIfExist(labelKey));
    this._cache.setLabelValues(timeRange, effectiveMatch, effectiveLimit, labelValues);
    return labelValues;
  };
}

class ResourceClientsCache {
  private readonly MAX_CACHE_ENTRIES = 1000; // Maximum number of cache entries
  private readonly MAX_CACHE_SIZE_BYTES = 50 * 1024 * 1024; // 50MB max cache size

  private _cache: Record<string, string[]> = {};
  private _accessTimestamps: Record<string, number> = {};

  constructor(private cacheLevel: PrometheusCacheLevel = PrometheusCacheLevel.High) {}

  public setLabelKeys(timeRange: TimeRange, match: string | undefined, limit: number, keys: string[]) {
    if (keys.length === 0) {
      return;
    }
    // Check and potentially clean cache before adding new entry
    this.cleanCacheIfNeeded();
    const cacheKey = this.getCacheKey(timeRange, match, limit, 'key');
    this._cache[cacheKey] = keys.slice().sort();
    this._accessTimestamps[cacheKey] = Date.now();
  }

  public getLabelKeys(timeRange: TimeRange, match: string | undefined, limit: number): string[] | undefined {
    const cacheKey = this.getCacheKey(timeRange, match, limit, 'key');
    const result = this._cache[cacheKey];
    if (result) {
      // Update access timestamp on cache hit
      this._accessTimestamps[cacheKey] = Date.now();
    }
    return result;
  }

  public setLabelValues(timeRange: TimeRange, match: string | undefined, limit: number, values: string[]) {
    if (values.length === 0) {
      return;
    }
    // Check and potentially clean cache before adding new entry
    this.cleanCacheIfNeeded();
    const cacheKey = this.getCacheKey(timeRange, match, limit, 'value');
    this._cache[cacheKey] = values.slice().sort();
    this._accessTimestamps[cacheKey] = Date.now();
  }

  public getLabelValues(timeRange: TimeRange, match: string, limit: number): string[] | undefined {
    const cacheKey = this.getCacheKey(timeRange, match, limit, 'value');
    const result = this._cache[cacheKey];
    if (result) {
      // Update access timestamp on cache hit
      this._accessTimestamps[cacheKey] = Date.now();
    }
    return result;
  }

  private getCacheKey(timeRange: TimeRange, match: string | undefined, limit: number, type: 'key' | 'value') {
    const snappedTimeRange = getRangeSnapInterval(this.cacheLevel, timeRange);
    return [snappedTimeRange.start, snappedTimeRange.end, limit, match, type].join('|');
  }

  private cleanCacheIfNeeded() {
    // Check number of entries
    const currentEntries = Object.keys(this._cache).length;
    if (currentEntries >= this.MAX_CACHE_ENTRIES) {
      // Calculate 20% of current entries, but ensure we remove at least 1 entry
      const entriesToRemove = Math.max(1, Math.floor(currentEntries - this.MAX_CACHE_ENTRIES + 1));
      this.removeOldestEntries(entriesToRemove);
    }

    // Check cache size in bytes
    const currentSize = this.getCacheSizeInBytes();
    if (currentSize > this.MAX_CACHE_SIZE_BYTES) {
      // Calculate 20% of current entries, but ensure we remove at least 1 entry
      const entriesToRemove = Math.max(1, Math.floor(Object.keys(this._cache).length * 0.2));
      this.removeOldestEntries(entriesToRemove);
    }
  }

  private getCacheSizeInBytes(): number {
    let size = 0;
    for (const key in this._cache) {
      // Calculate size of key
      size += key.length * 2; // Approximate size of string in bytes (UTF-16)

      // Calculate size of value array
      const value = this._cache[key];
      for (const item of value) {
        size += item.length * 2; // Approximate size of each string in bytes
      }
    }
    return size;
  }

  private removeOldestEntries(count: number) {
    // Get all entries sorted by timestamp (oldest first)
    const entries = Object.entries(this._accessTimestamps).sort(
      ([, timestamp1], [, timestamp2]) => timestamp1 - timestamp2
    );

    // Take the oldest 'count' entries
    const entriesToRemove = entries.slice(0, count);

    // Remove these entries from both cache and timestamps
    for (const [key] of entriesToRemove) {
      delete this._cache[key];
      delete this._accessTimestamps[key];
    }
  }
}

export function processSeries(series: Array<{ [key: string]: string }>, findValuesForKey?: string) {
  const metrics: Set<string> = new Set();
  const labelKeys: Set<string> = new Set();
  const labelValues: Set<string> = new Set();

  // Extract metrics and label keys
  series.forEach((item) => {
    // Add the __name__ value to metrics
    if (METRIC_LABEL in item) {
      metrics.add(item.__name__);
    }

    // Add all keys except __name__ to labelKeys
    Object.keys(item).forEach((key) => {
      if (key !== METRIC_LABEL) {
        labelKeys.add(key);
      }
      if (findValuesForKey && key === findValuesForKey) {
        labelValues.add(item[key]);
      }
    });
  });

  return {
    metrics: Array.from(metrics).sort(),
    labelKeys: Array.from(labelKeys).sort(),
    labelValues: Array.from(labelValues).sort(),
  };
}
