import {
  AdHocVariableFilter,
  getDefaultTimeRange,
  LanguageProvider,
  Scope,
  scopeFilterOperatorMap,
  ScopeSpecFilter,
  TimeRange,
} from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime';

import { PrometheusDatasource } from './datasource';
import {
  buildCacheHeaders,
  getDefaultCacheHeaders,
  isCancelledError,
  removeQuotesIfExist,
} from './lang_provider_shared';
import { fixSummariesMetadata, getRangeSnapInterval, processHistogramMetrics, processSeries } from './language_utils';
import { DEFAULT_SERIES_LIMIT, METRICS_LABEL_KEY, PromMetricsMetadata, PromQuery } from './types';
import { escapeForUtf8Support } from './utf8_support';

/**
 * Prometheus API endpoints for fetching resoruces
 */
const API_V1 = {
  METADATA: '/api/v1/metadata',
  SERIES: '/api/v1/series',
  LABELS: '/api/v1/labels',
  LABELS_VALUES: (labelKey: string) => `/api/v1/labels/${labelKey}/values`,
};

/**
 * Language provider for Prometheus.
 * Responsible for fetching metrics, labels, and metadata from Prometheus
 * and providing this information to the query editor.
 */
export class PrometheusLanguageProvider extends LanguageProvider {
  datasource: PrometheusDatasource;
  histogramMetrics: string[];
  metricsMetadata?: PromMetricsMetadata;
  metrics: string[];
  labelKeys: string[];

  constructor(datasource: PrometheusDatasource, initialValues?: Partial<PrometheusLanguageProvider>) {
    super();

    this.datasource = datasource;
    this.histogramMetrics = [];
    this.metrics = [];
    this.labelKeys = [];

    Object.assign(this, initialValues);
  }

  /**
   * Initializes the language provider by fetching metrics, metadata, and label keys.
   * Uses different strategies based on whether the Prometheus instance supports the labels match API.
   *
   * @param {TimeRange} timeRange - Time range to use for queries
   * @returns {Promise<any[]>} Promise that resolves when all data has been fetched
   */
  start = async (timeRange: TimeRange = getDefaultTimeRange()): Promise<any[]> => {
    if (this.datasource.lookupsDisabled) {
      return [];
    }

    if (this.datasource.hasLabelsMatchAPISupport()) {
      // use labels api
      this.metrics = (await this.fetchLabelValues(timeRange, METRICS_LABEL_KEY)) || [];
      this.histogramMetrics = processHistogramMetrics(this.metrics).sort();
      return Promise.all([this.fetchMetadata(), this.fetchLabelKeys(timeRange)]);
    }

    // Fallback to series endpoint
    const series = await this.fetchSeries(timeRange, '{__name__!=""}', DEFAULT_SERIES_LIMIT);
    const { metrics, labelKeys } = processSeries(series);
    this.metrics = metrics;
    this.labelKeys = labelKeys;
    this.histogramMetrics = processHistogramMetrics(this.metrics).sort();
    return Promise.all([this.fetchMetadata()]);
  };

  /**
   * Makes a request to the Prometheus API.
   * Handles GET vs POST requests differently:
   * - For GET requests, appends params to the URL and clears the params object
   * - For POST requests, sends params in the request body
   *
   * @param {string} url - API endpoint URL
   * @param {unknown} defaultValue - Default value to return if the request fails
   * @param {object} params - Request parameters
   * @param {Partial<BackendSrvRequest>} options - Additional request options
   * @returns {Promise<any>} Response data or defaultValue if the request fails
   */
  request = async (url: string, defaultValue: unknown, params = {}, options?: Partial<BackendSrvRequest>) => {
    try {
      // For GET requests, append params to URL and clear params object
      if (this.datasource.httpMethod === 'GET' && Object.keys(params).length > 0) {
        url += `?${new URLSearchParams(params).toString()}`;
        params = {};
      }

      const res = await this.datasource.metadataRequest(url, params, options);
      return res.data.data;
    } catch (error) {
      if (!isCancelledError(error)) {
        console.error(error);
      }
    }

    return defaultValue;
  };

  /**
   * Fetches metadata for metrics from Prometheus.
   * Sets cache headers based on the configured metadata cache duration.
   *
   * @returns {Promise<void>} Promise that resolves when metadata has been fetched
   */
  fetchMetadata = async () => {
    const secondsInDay = 86400;
    const headers = buildCacheHeaders(this.datasource.getDaysToCacheMetadata() * secondsInDay);
    const metadata = await this.request(
      API_V1.METADATA,
      {},
      {},
      {
        showErrorAlert: false,
        ...headers,
      }
    );
    this.metricsMetadata = fixSummariesMetadata(metadata);
  };

  // ===================================
  // Labels API
  // ===================================

  /**
   * Fetches all available label keys from Prometheus using labels endpoint.
   * Uses the labels endpoint with optional match parameter for filtering.
   *
   * @param {TimeRange} timeRange - Time range to use for the query
   * @param {string} match - Optional label matcher to filter results
   * @param {string} limit - Maximum number of results to return
   * @returns {Promise<string[]>} Array of label keys sorted alphabetically
   */
  fetchLabelKeys = async (
    timeRange: TimeRange,
    match?: string,
    limit: string = DEFAULT_SERIES_LIMIT
  ): Promise<string[]> => {
    let url = API_V1.LABELS;
    const timeParams = getRangeSnapInterval(this.datasource.cacheLevel, timeRange);
    const searchParams = { limit, ...timeParams, ...(match ? { 'match[]': match } : {}) };

    const res = await this.request(url, [], searchParams, getDefaultCacheHeaders(this.datasource.cacheLevel));
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
  fetchLabelValues = async (
    timeRange: TimeRange,
    labelKey: string,
    match?: string,
    limit: string = DEFAULT_SERIES_LIMIT
  ): Promise<string[]> => {
    const timeParams = this.datasource.getAdjustedInterval(timeRange);
    const searchParams = { limit, ...timeParams, ...(match ? { 'match[]': match } : {}) };
    const interpolatedName = this.datasource.interpolateString(labelKey);
    const interpolatedAndEscapedName = escapeForUtf8Support(removeQuotesIfExist(interpolatedName));
    const url = API_V1.LABELS_VALUES(interpolatedAndEscapedName);
    const value = await this.request(url, [], searchParams, getDefaultCacheHeaders(this.datasource.cacheLevel));
    return value ?? [];
  };

  // ===================================
  // Series API
  // ===================================

  /**
   * Fetches time series that match a specific label matcher using series endpoint.
   *
   * @param {TimeRange} timeRange - Time range to use for the query
   * @param {string} match - Label matcher to filter time series
   * @param {string} limit - Maximum number of series to return
   * @returns {Promise<Array<Record<string, string>>>} Array of series where each series is an object of label-value pairs
   */
  fetchSeries = async (
    timeRange: TimeRange,
    match: string,
    limit: string = DEFAULT_SERIES_LIMIT
  ): Promise<Array<Record<string, string>>> => {
    const timeParams = this.datasource.getTimeRangeParams(timeRange);
    const searchParams = { ...timeParams, 'match[]': match, limit };
    return await this.request(API_V1.SERIES, {}, searchParams, getDefaultCacheHeaders(this.datasource.cacheLevel));
  };

  // ===================================
  // Suggestions API
  // ===================================

  /**
   * Fetches label or value suggestions based on queries, scopes, and filters.
   
   *
   * @param {TimeRange} timeRange - Time range to use for the query
   * @param {PromQuery[]} queries - Array of Prometheus queries
   * @param {Scope[]} scopes - Array of filter scopes
   * @param {AdHocVariableFilter[]} adhocFilters - Array of ad-hoc filters
   * @param {string} labelName - Label name to fetch values for
   * @param {number} limit - Maximum number of suggestions to return
   * @param {string} requestId - Optional request ID for tracking
   * @returns {Promise<string[]>} Array of suggestions
   */
  fetchSuggestions = async (
    timeRange?: TimeRange,
    queries?: PromQuery[],
    scopes?: Scope[],
    adhocFilters?: AdHocVariableFilter[],
    labelName?: string,
    limit?: number,
    requestId?: string
  ): Promise<string[]> => {
    if (!timeRange) {
      timeRange = getDefaultTimeRange();
    }

    const url = '/suggestions';
    const timeParams = this.datasource.getAdjustedInterval(timeRange);
    const value = await this.request(
      url,
      [],
      {
        labelName,
        queries: queries?.map((q) =>
          this.datasource.interpolateString(q.expr, {
            ...this.datasource.getIntervalVars(),
            ...this.datasource.getRangeScopedVars(timeRange),
          })
        ),
        scopes: scopes?.reduce<ScopeSpecFilter[]>((acc, scope) => {
          acc.push(...scope.spec.filters);

          return acc;
        }, []),
        adhocFilters: adhocFilters?.map((filter) => ({
          key: filter.key,
          operator: scopeFilterOperatorMap[filter.operator],
          value: filter.value,
          values: filter.values,
        })),
        limit,
        ...timeParams,
      },
      {
        ...(requestId && { requestId }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }
    );

    return value ?? [];
  };
}
