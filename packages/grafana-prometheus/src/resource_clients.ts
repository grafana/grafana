import { TimeRange } from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime';

import { getDefaultCacheHeaders } from './caching';
import { DEFAULT_SERIES_LIMIT } from './components/metrics-browser/types';
import { PrometheusDatasource } from './datasource';
import { removeQuotesIfExist } from './language_provider';
import { getRangeSnapInterval, processHistogramMetrics } from './language_utils';
import { escapeForUtf8Support } from './utf8_support';

type PrometheusSeriesResponse = Array<{ [key: string]: string }>;
type PrometheusLabelsResponse = string[];

export interface ResourceApiClient {
  metrics: string[];
  histogramMetrics: string[];
  labelKeys: string[];
  cachedLabelValues: Record<string, string[]>;

  start: (timeRange: TimeRange) => Promise<void>;

  queryMetrics: (timeRange: TimeRange) => Promise<{ metrics: string[]; histogramMetrics: string[] }>;
  queryLabelKeys: (timeRange: TimeRange, match?: string, limit?: string) => Promise<string[]>;
  queryLabelValues: (timeRange: TimeRange, labelKey: string, match?: string, limit?: string) => Promise<string[]>;

  querySeries: (timeRange: TimeRange, match: string, limit?: string) => Promise<PrometheusSeriesResponse>;
}

type RequestFn = (
  url: string,
  params?: Record<string, unknown>,
  options?: Partial<BackendSrvRequest>
) => Promise<unknown>;

const EMPTY_MATCHER = '{}';
const MATCH_ALL_LABELS = '{__name__!=""}';
const METRIC_LABEL = '__name__';

export abstract class BaseResourceClient {
  constructor(
    protected readonly request: RequestFn,
    protected readonly datasource: PrometheusDatasource
  ) {}

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
   * Validates and transforms a matcher string for Prometheus series queries.
   *
   * @param match - The matcher string to validate and transform. Can be undefined, a specific matcher, or '{}'.
   * @returns The validated and potentially transformed matcher string.
   * @throws Error if the matcher is undefined or empty (null, undefined, or empty string).
   *
   * @example
   * // Returns '{__name__!=""}' for empty matcher
   * validateAndTransformMatcher('{}')
   *
   * // Returns the original matcher for specific matchers
   * validateAndTransformMatcher('{job="grafana"}')
   */
  protected validateAndTransformMatcher(match?: string): string {
    if (!match) {
      throw new Error('Series endpoint always expects at least one matcher');
    }
    return match === '{}' ? MATCH_ALL_LABELS : match;
  }

  /**
   * Fetches all time series that match a specific label matcher using **series** endpoint.
   *
   * @param {TimeRange} timeRange - Time range to use for the query
   * @param {string} match - Label matcher to filter time series
   * @param {string} limit - Maximum number of series to return
   */
  public querySeries = async (timeRange: TimeRange, match: string, limit: string = DEFAULT_SERIES_LIMIT) => {
    const effectiveMatch = this.validateAndTransformMatcher(match);
    const timeParams = this.datasource.getTimeRangeParams(timeRange);
    const searchParams = { ...timeParams, 'match[]': effectiveMatch, limit };
    return await this.requestSeries('/api/v1/series', searchParams, getDefaultCacheHeaders(this.datasource.cacheLevel));
  };
}

export class LabelsApiClient extends BaseResourceClient implements ResourceApiClient {
  public histogramMetrics: string[] = [];
  public metrics: string[] = [];
  public labelKeys: string[] = [];
  public cachedLabelValues: Record<string, string[]> = {};

  start = async (timeRange: TimeRange) => {
    await this.queryMetrics(timeRange);
    this.labelKeys = await this.queryLabelKeys(timeRange);
  };

  public queryMetrics = async (timeRange: TimeRange): Promise<{ metrics: string[]; histogramMetrics: string[] }> => {
    this.metrics = await this.queryLabelValues(timeRange, METRIC_LABEL);
    this.histogramMetrics = processHistogramMetrics(this.metrics);
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
  public queryLabelKeys = async (
    timeRange: TimeRange,
    match?: string,
    limit: string = DEFAULT_SERIES_LIMIT
  ): Promise<string[]> => {
    let url = '/api/v1/labels';
    const timeParams = getRangeSnapInterval(this.datasource.cacheLevel, timeRange);
    const searchParams = { limit, ...timeParams, ...(match ? { 'match[]': match } : {}) };

    const res = await this.requestLabels(url, searchParams, getDefaultCacheHeaders(this.datasource.cacheLevel));
    if (Array.isArray(res)) {
      this.labelKeys = res.slice().sort();
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
    limit: string = DEFAULT_SERIES_LIMIT
  ): Promise<string[]> => {
    const timeParams = this.datasource.getAdjustedInterval(timeRange);
    const searchParams = { limit, ...timeParams, ...(match ? { 'match[]': match } : {}) };
    const interpolatedName = this.datasource.interpolateString(labelKey);
    const interpolatedAndEscapedName = escapeForUtf8Support(removeQuotesIfExist(interpolatedName));
    const url = `/api/v1/label/${interpolatedAndEscapedName}/values`;
    const value = await this.requestLabels(url, searchParams, getDefaultCacheHeaders(this.datasource.cacheLevel));
    return value ?? [];
  };
}

export class SeriesApiClient extends BaseResourceClient implements ResourceApiClient {
  public histogramMetrics: string[] = [];
  public metrics: string[] = [];
  public labelKeys: string[] = [];
  public cachedLabelValues: Record<string, string[]> = {};

  start = async (timeRange: TimeRange) => {
    await this.queryMetrics(timeRange);
  };

  public queryMetrics = async (timeRange: TimeRange): Promise<{ metrics: string[]; histogramMetrics: string[] }> => {
    const series = await this.querySeries(timeRange, MATCH_ALL_LABELS);
    const { metrics, labelKeys } = processSeries(series);
    this.metrics = metrics;
    this.histogramMetrics = processHistogramMetrics(this.metrics);
    this.labelKeys = labelKeys;
    return { metrics: this.metrics, histogramMetrics: this.histogramMetrics };
  };

  public queryLabelKeys = async (
    timeRange: TimeRange,
    match?: string,
    limit: string = DEFAULT_SERIES_LIMIT
  ): Promise<string[]> => {
    const effectiveMatch = this.validateAndTransformMatcher(match);
    const series = await this.querySeries(timeRange, effectiveMatch, limit);
    const { labelKeys } = processSeries(series);
    return labelKeys;
  };

  public queryLabelValues = async (
    timeRange: TimeRange,
    labelKey: string,
    match?: string,
    limit: string = DEFAULT_SERIES_LIMIT
  ): Promise<string[]> => {
    const effectiveMatch = !match || match === EMPTY_MATCHER ? `{${labelKey}!=""}` : match;
    const series = await this.querySeries(timeRange, effectiveMatch, limit);
    const { labelValues } = processSeries(series, labelKey);
    return labelValues;
  };
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
