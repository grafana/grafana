// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/language_provider.ts
import Prism from 'prismjs';

import {
  AbstractLabelMatcher,
  AbstractLabelOperator,
  AbstractQuery,
  AdHocVariableFilter,
  getDefaultTimeRange,
  Scope,
  scopeFilterOperatorMap,
  ScopeSpecFilter,
  TimeRange,
} from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime';

import { buildCacheHeaders, getDaysToCacheMetadata, getDefaultCacheHeaders } from './caching';
import { PrometheusDatasource } from './datasource';
import { extractLabelMatchers, fixSummariesMetadata, toPromLikeQuery } from './language_utils';
import { promqlGrammar } from './promql';
import { buildVisualQueryFromString } from './querybuilder/parsing';
import { LabelsApiClient, ResourceApiClient, SeriesApiClient } from './resource_clients';
import { PromMetricsMetadata, PromQuery } from './types';

interface PrometheusBaseLanguageProvider {
  datasource: PrometheusDatasource;

  /**
   * When no timeRange provided, we will use the default time range (now/now-6h)
   * @param timeRange
   */
  start: (timeRange?: TimeRange) => Promise<unknown[]>;

  request: (url: string, params?: any, options?: Partial<BackendSrvRequest>) => Promise<any>;

  fetchSuggestions: (
    timeRange?: TimeRange,
    queries?: PromQuery[],
    scopes?: Scope[],
    adhocFilters?: AdHocVariableFilter[],
    labelName?: string,
    limit?: number,
    requestId?: string
  ) => Promise<string[]>;
}

/**
 * Modern implementation of the Prometheus language provider that abstracts API endpoint selection.
 *
 * Features:
 * - Automatically selects the most efficient API endpoint based on Prometheus version and configuration
 * - Supports both labels and series endpoints for backward compatibility
 * - Handles match[] parameters for filtering time series data
 * - Implements automatic request limiting (default: 40,000 series if not configured otherwise)
 * - Provides unified interface for both modern and legacy Prometheus versions
 * - Provides caching mechanism based on time range, limit, and match parameters
 *
 * @see LabelsApiClient For modern Prometheus versions using the labels API
 * @see SeriesApiClient For legacy Prometheus versions using the series API
 */
export interface PrometheusLanguageProviderInterface extends PrometheusBaseLanguageProvider {
  /**
   * Initializes the language provider by fetching metrics, label keys, and metrics metadata using Resource Clients.
   * All calls use the limit parameter from datasource configuration (default: 40,000 if not set).
   *
   * For backward compatibility, it calls _backwardCompatibleStart.
   * Some places still rely on deprecated fields. Until we replace them, we need _backwardCompatibleStart method.
   */
  start: (timeRange?: TimeRange) => Promise<unknown[]>;

  /**
   * Returns already cached metrics metadata including type and help information.
   * If there is no cached metadata, it returns an empty object.
   * To get fresh metadata, use queryMetricsMetadata instead.
   */
  retrieveMetricsMetadata: () => PromMetricsMetadata;

  /**
   * Returns already cached list of histogram metrics (identified by '_bucket' suffix).
   * If there are no cached histogram metrics, it returns an empty array.
   */
  retrieveHistogramMetrics: () => string[];

  /**
   * Returns already cached list of all available metric names.
   * If there are no cached metrics, it returns an empty array.
   */
  retrieveMetrics: () => string[];

  /**
   * Returns already cached list of available label keys.
   * If there are no cached label keys, it returns an empty array.
   */
  retrieveLabelKeys: () => string[];

  /**
   * Fetches fresh metrics metadata from Prometheus with optional limit.
   * Uses datasource's default limit if not specified.
   */
  queryMetricsMetadata: (limit?: number) => Promise<PromMetricsMetadata>;

  /**
   * Queries Prometheus for label keys within time range, optionally filtered by match selector.
   * Automatically selects labels or series endpoint based on datasource configuration.
   * If no limit is provided, uses the datasource's default limit configuration.
   * Use zero (0) to fetch all label keys, but this might return huge amounts of data.
   */
  queryLabelKeys: (timeRange: TimeRange, match?: string, limit?: number) => Promise<string[]>;

  /**
   * Queries Prometheus for values of a specific label key, optionally filtered by match selector.
   * Automatically selects labels or series endpoint based on datasource configuration.
   * If no limit is provided, uses the datasource's default limit configuration.
   * Use zero (0) to fetch all label values, but this might return huge amounts of data.
   */
  queryLabelValues: (timeRange: TimeRange, labelKey: string, match?: string, limit?: number) => Promise<string[]>;
}

export class PrometheusLanguageProvider implements PrometheusLanguageProviderInterface {
  public datasource: PrometheusDatasource;

  private _metricsMetadata?: PromMetricsMetadata;
  private _resourceClient?: ResourceApiClient;

  constructor(datasource: PrometheusDatasource) {
    this.datasource = datasource;
  }

  request = async (url: string, params = {}, options?: Partial<BackendSrvRequest>) => {
    try {
      const res = await this.datasource.metadataRequest(url, params, options);
      return res.data.data;
    } catch (error) {
      if (!isCancelledError(error)) {
        console.error(error);
      }
    }

    return undefined;
  };

  /**
   * Lazily initializes and returns the appropriate resource client based on Prometheus version.
   *
   * The client selection logic:
   * - For Prometheus v2.6+ with labels API: Uses LabelsApiClient for efficient label-based queries
   * - For older versions: Falls back to SeriesApiClient for backward compatibility
   *
   * The client instance is cached after first initialization to avoid repeated creation.
   *
   * @returns {ResourceApiClient} An instance of either LabelsApiClient or SeriesApiClient
   */
  private get resourceClient(): ResourceApiClient {
    if (!this._resourceClient) {
      this._resourceClient = this.datasource.hasLabelsMatchAPISupport()
        ? new LabelsApiClient(this.request, this.datasource)
        : new SeriesApiClient(this.request, this.datasource);
    }

    return this._resourceClient;
  }

  /**
   * Same start logic but it uses resource clients. Backward compatibility it calls _backwardCompatibleStart.
   * Some places still relies on deprecated fields. Until we replace them we need _backwardCompatibleStart method
   */
  start = async (timeRange: TimeRange = getDefaultTimeRange()): Promise<unknown[]> => {
    if (this.datasource.lookupsDisabled) {
      return [];
    }
    return await Promise.all([
      this.resourceClient.start(timeRange),
      this.queryMetricsMetadata(this.datasource.seriesLimit),
    ]);
  };

  /**
   * Fetches metadata for metrics from Prometheus.
   * Sets cache headers based on the configured metadata cache duration.
   *
   * @returns {Promise<PromMetricsMetadata>} Promise that resolves when metadata has been fetched
   */
  private _queryMetadata = async (limit?: number): Promise<PromMetricsMetadata> => {
    const secondsInDay = 86400;
    const headers = buildCacheHeaders(getDaysToCacheMetadata(this.datasource.cacheLevel) * secondsInDay);
    const metadata = await this.request(
      `/api/v1/metadata`,
      { limit: limit ?? this.datasource.seriesLimit },
      {
        showErrorAlert: false,
        ...headers,
      }
    );
    return fixSummariesMetadata(metadata);
  };

  /**
   * Retrieves the cached Prometheus metrics metadata.
   * This metadata includes type information (counter, gauge, etc.) and help text for metrics.
   *
   * @returns {PromMetricsMetadata} Cached metadata or empty object if not yet fetched
   */
  public retrieveMetricsMetadata = (): PromMetricsMetadata => {
    return this._metricsMetadata ?? {};
  };

  /**
   * Retrieves the list of histogram metrics from the current resource client.
   * Histogram metrics are identified by the '_bucket' suffix and are used for percentile calculations.
   *
   * @returns {string[]} Array of histogram metric names
   */
  public retrieveHistogramMetrics = (): string[] => {
    return this.resourceClient?.histogramMetrics;
  };

  /**
   * Retrieves the complete list of available metrics from the current resource client.
   * This includes all metric names regardless of their type (counter, gauge, histogram).
   *
   * @returns {string[]} Array of all metric names
   */
  public retrieveMetrics = (): string[] => {
    return this.resourceClient?.metrics;
  };

  /**
   * Retrieves the list of available label keys from the current resource client.
   * Label keys are the names of labels that can be used to filter and group metrics.
   *
   * @returns {string[]} Array of label key names
   */
  public retrieveLabelKeys = (): string[] => {
    return this.resourceClient?.labelKeys;
  };

  /**
   * Fetches fresh metrics metadata from Prometheus and updates the cache.
   * This includes querying for metric types, help text, and unit information.
   * If the fetch fails, the cache is set to an empty object to prevent stale data.
   *
   * @returns {Promise<PromMetricsMetadata>} Promise that resolves to the fetched metadata
   */
  public queryMetricsMetadata = async (limit?: number): Promise<PromMetricsMetadata> => {
    try {
      this._metricsMetadata = (await this._queryMetadata(limit)) ?? {};
    } catch (error) {
      this._metricsMetadata = {};
    }
    return this._metricsMetadata;
  };

  /**
   * Fetches all available label keys that match the specified criteria.
   *
   * This method queries Prometheus for label keys within the specified time range.
   * The results can be filtered using the match parameter and limited in size.
   * Uses either the labels API (Prometheus v2.6+) or series API based on version.
   *
   * @param {TimeRange} timeRange - Time range to search for label keys
   * @param {string} [match] - Optional PromQL selector to filter label keys (e.g., '{job="grafana"}')
   * @param {string} [limit] - Optional maximum number of label keys to return
   * @returns {Promise<string[]>} Array of matching label key names, sorted alphabetically
   */
  public queryLabelKeys = async (timeRange: TimeRange, match?: string, limit?: number): Promise<string[]> => {
    const interpolatedMatch = match ? this.datasource.interpolateString(match) : match;
    return await this.resourceClient.queryLabelKeys(timeRange, interpolatedMatch, limit);
  };

  /**
   * Fetches all values for a specific label key that match the specified criteria.
   *
   * This method queries Prometheus for label values within the specified time range.
   * Results can be filtered using the match parameter to find values in specific contexts.
   * Supports both modern (labels API) and legacy (series API) Prometheus versions.
   *
   * The method automatically handles UTF-8 encoded label keys by properly escaping them
   * before making API requests. This means you can safely pass label keys containing
   * special characters like dots, colons, or Unicode characters (e.g., 'http.status:code',
   * 'μs', 'response.time').
   *
   * @param {TimeRange} timeRange - Time range to search for label values
   * @param {string} labelKey - The label key to fetch values for (e.g., 'job', 'instance', 'http.status:code')
   * @param {string} [match] - Optional PromQL selector to filter values (e.g., '{job="grafana"}')
   * @param {string} [limit] - Optional maximum number of values to return
   * @returns {Promise<string[]>} Array of matching label values, sorted alphabetically
   * @example
   * // Fetch all values for the 'job' label
   * const values = await queryLabelValues(timeRange, 'job');
   * // Fetch 'instance' values only for jobs matching 'grafana'
   * const instances = await queryLabelValues(timeRange, 'instance', '{job="grafana"}');
   * // Fetch values for a label key with special characters
   * const statusCodes = await queryLabelValues(timeRange, 'http.status:code');
   */
  public queryLabelValues = async (
    timeRange: TimeRange,
    labelKey: string,
    match?: string,
    limit?: number
  ): Promise<string[]> => {
    const interpolatedMatch = match ? this.datasource.interpolateString(match) : match;
    return await this.resourceClient.queryLabelValues(
      timeRange,
      this.datasource.interpolateString(labelKey),
      interpolatedMatch,
      limit
    );
  };

  /**
   * Fetch labels or values for a label based on the queries, scopes, filters and time range
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
      {
        labelName,
        queries: queries?.map((q) =>
          this.datasource.interpolateString(q.expr, {
            ...this.datasource.getIntervalVars(),
            ...this.datasource.getRangeScopedVars(timeRange),
          })
        ),
        scopes: scopes?.reduce<ScopeSpecFilter[]>((acc, scope) => {
          if (scope.spec.filters) {
            acc.push(...scope.spec.filters);
          }

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
          ...getDefaultCacheHeaders(this.datasource.cacheLevel)?.headers,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }
    );

    return value ?? [];
  };
}

export const importFromAbstractQuery = (labelBasedQuery: AbstractQuery): PromQuery => {
  return toPromLikeQuery(labelBasedQuery);
};

export const exportToAbstractQuery = (query: PromQuery): AbstractQuery => {
  const promQuery = query.expr;
  if (!promQuery || promQuery.length === 0) {
    return { refId: query.refId, labelMatchers: [] };
  }
  const tokens = Prism.tokenize(promQuery, promqlGrammar);
  const labelMatchers: AbstractLabelMatcher[] = extractLabelMatchers(tokens);
  const nameLabelValue = getNameLabelValue(promQuery, tokens);
  if (nameLabelValue && nameLabelValue.length > 0) {
    labelMatchers.push({
      name: '__name__',
      operator: AbstractLabelOperator.Equal,
      value: nameLabelValue,
    });
  }

  return {
    refId: query.refId,
    labelMatchers,
  };
};

/**
 * Checks if an error is a cancelled request error.
 * Used to avoid logging cancelled request errors.
 *
 * @param {unknown} error - Error to check
 * @returns {boolean} True if the error is a cancelled request error
 */
function isCancelledError(error: unknown): error is {
  cancelled: boolean;
} {
  return typeof error === 'object' && error !== null && 'cancelled' in error && error.cancelled === true;
}

function getNameLabelValue(promQuery: string, tokens: Array<string | Prism.Token>): string {
  let nameLabelValue = '';

  for (const token of tokens) {
    if (typeof token === 'string') {
      nameLabelValue = token;
      break;
    }
  }
  return nameLabelValue;
}

/**
 * Extracts metrics from queries and populates match parameters.
 * This is used to filter time series data based on existing queries.
 * Handles UTF8 metrics by properly escaping them.
 *
 * @param {PromQuery[]} queries - Array of Prometheus queries
 * @returns {string[]} Metric names as a regex matcher inside the array for easy handling
 */
export const populateMatchParamsFromQueries = (queries?: PromQuery[]): string[] => {
  if (!queries) {
    return [];
  }

  const metrics = (queries ?? []).reduce<string[]>((params, query) => {
    const visualQuery = buildVisualQueryFromString(query.expr);
    if (visualQuery.query.metric !== '') {
      params.push(visualQuery.query.metric);
    }
    if (visualQuery.query.binaryQueries) {
      visualQuery.query.binaryQueries.forEach((bq) => {
        if (bq.query.metric !== '') {
          params.push(bq.query.metric);
        }
      });
    }
    return params;
  }, []);

  return metrics.length === 0 ? [] : [`__name__=~"${metrics.join('|')}"`];
};
