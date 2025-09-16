// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/language_provider.ts
import { once } from 'lodash';
import Prism from 'prismjs';

import {
  AbstractLabelMatcher,
  AbstractLabelOperator,
  AbstractQuery,
  AdHocVariableFilter,
  getDefaultTimeRange,
  LanguageProvider,
  Scope,
  scopeFilterOperatorMap,
  ScopeSpecFilter,
  TimeRange,
} from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime';

import { buildCacheHeaders, getDaysToCacheMetadata, getDefaultCacheHeaders } from './caching';
import { Label } from './components/monaco-query-field/monaco-completion-provider/situation';
import { DEFAULT_SERIES_LIMIT, EMPTY_SELECTOR, REMOVE_SERIES_LIMIT } from './constants';
import { PrometheusDatasource } from './datasource';
import {
  extractLabelMatchers,
  fixSummariesMetadata,
  processHistogramMetrics,
  processLabels,
  removeQuotesIfExist,
  toPromLikeQuery,
} from './language_utils';
import { promqlGrammar } from './promql';
import { buildVisualQueryFromString } from './querybuilder/parsing';
import { LabelsApiClient, ResourceApiClient, SeriesApiClient } from './resource_clients';
import { PromMetricsMetadata, PromQuery } from './types';
import { escapeForUtf8Support, isValidLegacyName } from './utf8_support';

const DEFAULT_KEYS = ['job', 'instance'];

/**
 * Prometheus API endpoints for fetching resources
 */
const API_V1 = {
  METADATA: '/api/v1/metadata',
  SERIES: '/api/v1/series',
  LABELS: '/api/v1/labels',
  LABELS_VALUES: (labelKey: string) => `/api/v1/label/${labelKey}/values`,
};

interface PrometheusBaseLanguageProvider {
  datasource: PrometheusDatasource;

  /**
   * When no timeRange provided, we will use the default time range (now/now-6h)
   * @param timeRange
   */
  start: (timeRange?: TimeRange) => Promise<any[]>;

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
 * @deprecated This interface is deprecated and will be removed.
 */
interface PrometheusLegacyLanguageProvider {
  /**
   * @deprecated Use retrieveHistogramMetrics() method instead
   */
  histogramMetrics: string[];
  /**
   * @deprecated Use retrieveMetrics() method instead
   */
  metrics: string[];
  /**
   * @deprecated Use retrieveMetricsMetadata() method instead
   */
  metricsMetadata?: PromMetricsMetadata;
  /**
   * @deprecated Use retrieveLabelKeys() method instead
   */
  labelKeys: string[];

  /**
   * @deprecated Use queryMetricsMetadata() method instead.
   */
  loadMetricsMetadata: () => void;
  /**
   * @deprecated Use retrieveMetricsMetadata() method instead
   */
  getLabelKeys: () => string[];
  /**
   * @deprecated If you need labelKeys or labelValues please use queryLabelKeys() or queryLabelValues() functions
   */
  getSeries: (timeRange: TimeRange, selector: string, withName?: boolean) => Promise<Record<string, string[]>>;
  /**
   * @deprecated Use queryLabelValues() method insteadIt'll determine the right endpoint based on the datasource settings
   */
  fetchLabelValues: (range: TimeRange, key: string, limit?: string | number) => Promise<string[]>;
  /**
   * @deprecated Use queryLabelValues() method insteadIt'll determine the right endpoint based on the datasource settings
   */
  getLabelValues: (range: TimeRange, key: string) => Promise<string[]>;
  /**
   * @deprecated If you need labelKeys or labelValues please use queryLabelKeys() or queryLabelValues() functions
   */
  fetchLabels: (timeRange: TimeRange, queries?: PromQuery[], limit?: string) => Promise<string[]>;
  /**
   * @deprecated Use queryLabelValues() method insteadIt'll determine the right endpoint based on the datasource settings
   */
  getSeriesValues: (timeRange: TimeRange, labelName: string, selector: string) => Promise<string[]>;
  /**
   * @deprecated Use queryLabelValues() method insteadIt'll determine the right endpoint based on the datasource settings
   */
  fetchSeriesValuesWithMatch: (
    timeRange: TimeRange,
    name: string,
    match?: string,
    requestId?: string,
    withLimit?: string | number
  ) => Promise<string[]>;
  /**
   * @deprecated Use queryLabelKeys() method instead. It'll determine the right endpoint based on the datasource settings
   */
  getSeriesLabels: (timeRange: TimeRange, selector: string, otherLabels: Label[]) => Promise<string[]>;
  /**
   * @deprecated Use queryLabelKeys() method instead. It'll determine the right endpoint based on the datasource settings
   */
  fetchLabelsWithMatch: (
    timeRange: TimeRange,
    name: string,
    withName?: boolean,
    withLimit?: string | number
  ) => Promise<Record<string, string[]>>;
  /**
   * @deprecated Use queryLabelKeys() method instead. It'll determine the right endpoint based on the datasource settings
   */
  fetchSeriesLabels: (
    timeRange: TimeRange,
    name: string,
    withName?: boolean,
    withLimit?: string | number
  ) => Promise<Record<string, string[]>>;
  /**
   * @deprecated Use queryLabelKeys() method instead. It'll determine the right endpoint based on the datasource settings
   */
  fetchSeriesLabelsMatch: (
    timeRange: TimeRange,
    name: string,
    withLimit?: string | number
  ) => Promise<Record<string, string[]>>;
  /**
   * @deprecated If you need labelKeys or labelValues please use queryLabelKeys() or queryLabelValues() functions
   */
  fetchSeries: (timeRange: TimeRange, match: string) => Promise<Array<Record<string, string>>>;
  /**
   * @deprecated If you need labelKeys or labelValues please use queryLabelKeys() or queryLabelValues() functions
   */
  fetchDefaultSeries: (timeRange: TimeRange) => Promise<{}>;
}

/**
 * Old implementation of prometheus language provider.
 * @deprecated Use PrometheusLanguageProviderInterface and PrometheusLanguageProvider class instead.
 */
export default class PromQlLanguageProvider extends LanguageProvider implements PrometheusLegacyLanguageProvider {
  declare startTask: Promise<any>;
  declare labelFetchTs: number;

  datasource: PrometheusDatasource;

  histogramMetrics: string[];
  metrics: string[];
  metricsMetadata?: PromMetricsMetadata;
  labelKeys: string[] = [];

  constructor(datasource: PrometheusDatasource, initialValues?: Partial<PromQlLanguageProvider>) {
    super();

    this.datasource = datasource;
    this.histogramMetrics = [];
    this.metrics = [];

    Object.assign(this, initialValues);
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
   * Overridden by PrometheusLanguageProvider
   */
  start = async (timeRange: TimeRange = getDefaultTimeRange()): Promise<any[]> => {
    if (this.datasource.lookupsDisabled) {
      return [];
    }

    this.metrics = (await this.fetchLabelValues(timeRange, '__name__')) || [];
    this.histogramMetrics = processHistogramMetrics(this.metrics).sort();
    return Promise.all([this.loadMetricsMetadata(), this.fetchLabels(timeRange)]);
  };

  async loadMetricsMetadata() {
    const secondsInDay = 86400;
    const headers = buildCacheHeaders(getDaysToCacheMetadata(this.datasource.cacheLevel) * secondsInDay);
    this.metricsMetadata = fixSummariesMetadata(
      await this.request(
        API_V1.METADATA,
        {},
        {
          showErrorAlert: false,
          ...headers,
        }
      )
    );
  }

  getLabelKeys(): string[] {
    return this.labelKeys;
  }

  async getSeries(timeRange: TimeRange, selector: string, withName?: boolean): Promise<Record<string, string[]>> {
    if (this.datasource.lookupsDisabled) {
      return {};
    }
    try {
      if (selector === EMPTY_SELECTOR) {
        return await this.fetchDefaultSeries(timeRange);
      } else {
        return await this.fetchSeriesLabels(timeRange, selector, withName, REMOVE_SERIES_LIMIT);
      }
    } catch (error) {
      // TODO: better error handling
      console.error(error);
      return {};
    }
  }

  fetchLabelValues = async (range: TimeRange, key: string, limit?: string | number): Promise<string[]> => {
    const params = { ...this.datasource.getAdjustedInterval(range), ...(limit ? { limit } : {}) };
    const interpolatedName = this.datasource.interpolateString(key);
    const interpolatedAndEscapedName = escapeForUtf8Support(removeQuotesIfExist(interpolatedName));
    const value = await this.request(
      API_V1.LABELS_VALUES(interpolatedAndEscapedName),
      params,
      getDefaultCacheHeaders(this.datasource.cacheLevel)
    );
    return value ?? [];
  };

  async getLabelValues(range: TimeRange, key: string): Promise<string[]> {
    return await this.fetchLabelValues(range, key);
  }

  /**
   * Fetches all label keys
   */
  fetchLabels = async (timeRange: TimeRange, queries?: PromQuery[], limit?: string): Promise<string[]> => {
    let url = API_V1.LABELS;
    const timeParams = this.datasource.getAdjustedInterval(timeRange);
    this.labelFetchTs = Date.now().valueOf();

    const searchParams = new URLSearchParams({ ...timeParams, ...(limit ? { limit } : {}) });
    queries?.forEach((q) => {
      const visualQuery = buildVisualQueryFromString(q.expr);
      if (visualQuery.query.metric !== '') {
        const isUtf8Metric = !isValidLegacyName(visualQuery.query.metric);
        searchParams.append('match[]', isUtf8Metric ? `{"${visualQuery.query.metric}"}` : visualQuery.query.metric);
        if (visualQuery.query.binaryQueries) {
          visualQuery.query.binaryQueries.forEach((bq) => {
            searchParams.append('match[]', isUtf8Metric ? `{"${bq.query.metric}"}` : bq.query.metric);
          });
        }
      }
    });

    if (this.datasource.httpMethod === 'GET') {
      url += `?${searchParams.toString()}`;
    }

    const res = await this.request(url, searchParams, getDefaultCacheHeaders(this.datasource.cacheLevel));
    if (Array.isArray(res)) {
      this.labelKeys = res.slice().sort();
      return [...this.labelKeys];
    }

    return [];
  };

  /**
   * Gets series values
   * Function to replace old getSeries calls in a way that will provide faster endpoints
   * for new prometheus instances, while maintaining backward compatability
   */
  getSeriesValues = async (timeRange: TimeRange, labelName: string, selector: string): Promise<string[]> => {
    if (!this.datasource.hasLabelsMatchAPISupport()) {
      const data = await this.getSeries(timeRange, selector);
      return data[removeQuotesIfExist(labelName)] ?? [];
    }
    return await this.fetchSeriesValuesWithMatch(timeRange, labelName, selector);
  };

  /**
   * Fetches all values for a label, with optional match[]
   */
  fetchSeriesValuesWithMatch = async (
    timeRange: TimeRange,
    name: string,
    match?: string,
    requestId?: string,
    withLimit?: string | number
  ): Promise<string[]> => {
    const interpolatedName = name ? this.datasource.interpolateString(name) : null;
    const interpolatedMatch = match ? this.datasource.interpolateString(match) : null;
    const range = this.datasource.getAdjustedInterval(timeRange);
    const urlParams = {
      ...range,
      ...(interpolatedMatch && { 'match[]': interpolatedMatch }),
      ...(withLimit ? { limit: withLimit } : {}),
    };
    let requestOptions: Partial<BackendSrvRequest> | undefined = {
      ...getDefaultCacheHeaders(this.datasource.cacheLevel),
      ...(requestId && { requestId }),
    };

    if (!Object.keys(requestOptions).length) {
      requestOptions = undefined;
    }

    const interpolatedAndEscapedName = escapeForUtf8Support(removeQuotesIfExist(interpolatedName ?? ''));

    const value = await this.request(API_V1.LABELS_VALUES(interpolatedAndEscapedName), urlParams, requestOptions);
    return value ?? [];
  };

  /**
   * Gets series labels
   * Function to replace old getSeries calls in a way that will provide faster endpoints for new prometheus instances,
   * while maintaining backward compatability. The old API call got the labels and the values in a single query,
   * but with the new query we need two calls, one to get the labels, and another to get the values.
   */
  getSeriesLabels = async (timeRange: TimeRange, selector: string, otherLabels: Label[]): Promise<string[]> => {
    let possibleLabelNames, data: Record<string, string[]>;

    if (!this.datasource.hasLabelsMatchAPISupport()) {
      data = await this.getSeries(timeRange, selector);
      possibleLabelNames = Object.keys(data); // all names from prometheus
    } else {
      // Exclude __name__ from output
      otherLabels.push({ name: '__name__', value: '', op: '!=' });
      data = await this.fetchSeriesLabelsMatch(timeRange, selector);
      possibleLabelNames = Object.keys(data);
    }

    const usedLabelNames = new Set(otherLabels.map((l) => l.name)); // names used in the query
    return possibleLabelNames.filter((l) => !usedLabelNames.has(l));
  };

  /**
   * Fetch labels using the best endpoint that datasource supports.
   * This is cached by its args but also by the global timeRange currently selected as they can change over requested time.
   */
  fetchLabelsWithMatch = async (
    timeRange: TimeRange,
    name: string,
    withName?: boolean,
    withLimit?: string | number
  ): Promise<Record<string, string[]>> => {
    if (this.datasource.hasLabelsMatchAPISupport()) {
      return this.fetchSeriesLabelsMatch(timeRange, name, withLimit);
    } else {
      return this.fetchSeriesLabels(timeRange, name, withName, REMOVE_SERIES_LIMIT);
    }
  };

  /**
   * Fetch labels for a series using /series endpoint. This is cached by its args but also by the global timeRange currently selected as
   * they can change over requested time.
   */
  fetchSeriesLabels = async (
    timeRange: TimeRange,
    name: string,
    withName?: boolean,
    withLimit?: string | number
  ): Promise<Record<string, string[]>> => {
    const interpolatedName = this.datasource.interpolateString(name);
    const range = this.datasource.getAdjustedInterval(timeRange);
    let urlParams = {
      ...range,
      'match[]': interpolatedName,
      ...(withLimit !== 'none' ? { limit: withLimit ?? DEFAULT_SERIES_LIMIT } : {}),
    };

    const data = await this.request(API_V1.SERIES, urlParams, getDefaultCacheHeaders(this.datasource.cacheLevel));
    const { values } = processLabels(data, withName);
    return values;
  };

  /**
   * Fetch labels for a series using /labels endpoint.  This is cached by its args but also by the global timeRange currently selected as
   * they can change over requested time.
   */
  fetchSeriesLabelsMatch = async (
    timeRange: TimeRange,
    name: string,
    withLimit?: string | number
  ): Promise<Record<string, string[]>> => {
    const interpolatedName = this.datasource.interpolateString(name);
    const range = this.datasource.getAdjustedInterval(timeRange);
    const urlParams = {
      ...range,
      'match[]': interpolatedName,
      ...(withLimit ? { limit: withLimit } : {}),
    };

    const data: string[] = await this.request(
      API_V1.LABELS,
      urlParams,
      getDefaultCacheHeaders(this.datasource.cacheLevel)
    );
    // Convert string array to Record<string , []>
    return data.reduce((ac, a) => ({ ...ac, [a]: '' }), {});
  };

  /**
   * Fetch series for a selector. Use this for raw results. Use fetchSeriesLabels() to get labels.
   */
  fetchSeries = async (timeRange: TimeRange, match: string): Promise<Array<Record<string, string>>> => {
    const range = this.datasource.getTimeRangeParams(timeRange);
    const params = { ...range, 'match[]': match };
    return await this.request(API_V1.SERIES, params, getDefaultCacheHeaders(this.datasource.cacheLevel));
  };

  /**
   * Fetch this only one as we assume this won't change over time. This is cached differently from fetchSeriesLabels
   * because we can cache more aggressively here and also we do not want to invalidate this cache the same way as in
   * fetchSeriesLabels.
   */
  fetchDefaultSeries = once(async (timeRange: TimeRange) => {
    const values = await Promise.all(DEFAULT_KEYS.map((key) => this.fetchLabelValues(timeRange, key)));
    return DEFAULT_KEYS.reduce((acc, key, i) => ({ ...acc, [key]: values[i] }), {});
  });

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
          ...getDefaultCacheHeaders(this.datasource.cacheLevel)?.headers,
          'Content-Type': 'application/json',
        },
        method: 'POST',
      }
    );

    return value ?? [];
  };
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
export interface PrometheusLanguageProviderInterface
  extends PrometheusBaseLanguageProvider,
    PrometheusLegacyLanguageProvider {
  /**
   * Initializes the language provider by fetching metrics, label keys, and metrics metadata using Resource Clients.
   * All calls use the limit parameter from datasource configuration (default: 40,000 if not set).
   *
   * For backward compatibility, it calls _backwardCompatibleStart.
   * Some places still rely on deprecated fields. Until we replace them, we need _backwardCompatibleStart method.
   */
  start: (timeRange?: TimeRange) => Promise<any[]>;

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

export class PrometheusLanguageProvider extends PromQlLanguageProvider implements PrometheusLanguageProviderInterface {
  private _metricsMetadata?: PromMetricsMetadata;
  private _resourceClient?: ResourceApiClient;

  constructor(datasource: PrometheusDatasource) {
    super(datasource);
  }

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
  start = async (timeRange: TimeRange = getDefaultTimeRange()): Promise<any[]> => {
    if (this.datasource.lookupsDisabled) {
      return [];
    }
    await Promise.all([this.resourceClient.start(timeRange), this.queryMetricsMetadata(this.datasource.seriesLimit)]);
    return this._backwardCompatibleStart();
  };

  /**
   * This private method exists to make sure the old class will be functional until we remove it.
   * When we remove old class (PromQlLanguageProvider) we should remove this method too.
   */
  private _backwardCompatibleStart = async () => {
    this.metricsMetadata = this.retrieveMetricsMetadata();
    this.metrics = this.retrieveMetrics();
    this.histogramMetrics = this.retrieveHistogramMetrics();
    this.labelKeys = this.retrieveLabelKeys();
    return [];
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
      API_V1.METADATA,
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
