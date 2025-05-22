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

import { DEFAULT_SERIES_LIMIT, REMOVE_SERIES_LIMIT } from './components/metrics-browser/types';
import { Label } from './components/monaco-query-field/monaco-completion-provider/situation';
import { PrometheusDatasource } from './datasource';
import {
  extractLabelMatchers,
  fixSummariesMetadata,
  getClientCacheDurationInMinutes,
  processHistogramMetrics,
  processLabels,
  toPromLikeQuery,
} from './language_utils';
import PromqlSyntax from './promql';
import { buildVisualQueryFromString } from './querybuilder/parsing';
import { PrometheusCacheLevel, PromMetricsMetadata, PromQuery } from './types';
import { escapeForUtf8Support, isValidLegacyName } from './utf8_support';

const DEFAULT_KEYS = ['job', 'instance'];
const EMPTY_SELECTOR = '{}';
// Max number of items (metrics, labels, values) that we display as suggestions. Prevents from running out of memory.
export const SUGGESTIONS_LIMIT = 10000;

/**
 * Prometheus API endpoints for fetching resoruces
 */
const API_V1 = {
  METADATA: '/api/v1/metadata',
  SERIES: '/api/v1/series',
  LABELS: '/api/v1/labels',
  LABELS_VALUES: (labelKey: string) => `/api/v1/label/${labelKey}/values`,
};

type UrlParamsType = {
  start?: string;
  end?: string;
  'match[]'?: string;
  limit?: string;
};

/**
 * Builds cache headers for Prometheus API requests.
 *
 * @param {number} durationInSeconds - Cache duration in seconds
 * @returns {object} Object with headers property containing cache headers
 */
const buildCacheHeaders = (durationInSeconds: number) => {
  return {
    headers: {
      'X-Grafana-Cache': `private, max-age=${durationInSeconds}`,
    },
  };
};

/**
 * Gets appropriate cache headers based on the configured cache level.
 * Returns undefined if caching is disabled.
 *
 * @param {PrometheusCacheLevel} cacheLevel - Cache level (None, Low, Medium, High)
 * @returns {object|undefined} Cache headers object or undefined if caching is disabled
 */
const getDefaultCacheHeaders = (cacheLevel: PrometheusCacheLevel) => {
  if (cacheLevel !== PrometheusCacheLevel.None) {
    return buildCacheHeaders(getClientCacheDurationInMinutes(cacheLevel) * 60);
  }
  return;
};

export function getMetadataString(metric: string, metadata: PromMetricsMetadata): string | undefined {
  if (!metadata[metric]) {
    return undefined;
  }
  const { type, help } = metadata[metric];
  return `${type.toUpperCase()}: ${help}`;
}

export function getMetadataHelp(metric: string, metadata: PromMetricsMetadata): string | undefined {
  if (!metadata[metric]) {
    return undefined;
  }
  return metadata[metric].help;
}

export function getMetadataType(metric: string, metadata: PromMetricsMetadata): string | undefined {
  if (!metadata[metric]) {
    return undefined;
  }
  return metadata[metric].type;
}

const secondsInDay = 86400;
export default class PromQlLanguageProvider extends LanguageProvider {
  histogramMetrics: string[];
  metrics: string[];
  metricsMetadata?: PromMetricsMetadata;
  declare startTask: Promise<any>;
  datasource: PrometheusDatasource;
  labelKeys: string[] = [];
  declare labelFetchTs: number;

  constructor(datasource: PrometheusDatasource, initialValues?: Partial<PromQlLanguageProvider>) {
    super();

    this.datasource = datasource;
    this.histogramMetrics = [];
    this.metrics = [];

    Object.assign(this, initialValues);
  }

  request = async (url: string, defaultValue: unknown, params = {}, options?: Partial<BackendSrvRequest>) => {
    try {
      const res = await this.datasource.metadataRequest(url, params, options);
      return res.data.data;
    } catch (error) {
      if (!isCancelledError(error)) {
        console.error(error);
      }
    }

    return defaultValue;
  };

  start = async (timeRange: TimeRange = getDefaultTimeRange()): Promise<any[]> => {
    if (this.datasource.lookupsDisabled) {
      return [];
    }

    this.metrics = (await this.fetchLabelValues(timeRange, '__name__')) || [];
    this.histogramMetrics = processHistogramMetrics(this.metrics).sort();
    return Promise.all([this.loadMetricsMetadata(), this.fetchLabels(timeRange)]);
  };

  async loadMetricsMetadata() {
    const headers = buildCacheHeaders(this.datasource.getDaysToCacheMetadata() * secondsInDay);
    this.metricsMetadata = fixSummariesMetadata(
      await this.request(
        API_V1.METADATA,
        {},
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

  fetchLabelValues = async (range: TimeRange, key: string, limit?: string): Promise<string[]> => {
    const params = { ...this.datasource.getAdjustedInterval(range), ...(limit ? { limit } : {}) };
    const interpolatedName = this.datasource.interpolateString(key);
    const interpolatedAndEscapedName = escapeForUtf8Support(removeQuotesIfExist(interpolatedName));
    const value = await this.request(
      API_V1.LABELS_VALUES(interpolatedAndEscapedName),
      [],
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

    const res = await this.request(url, [], searchParams, getDefaultCacheHeaders(this.datasource.cacheLevel));
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
    withLimit?: string
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

    const value = await this.request(API_V1.LABELS_VALUES(interpolatedAndEscapedName), [], urlParams, requestOptions);
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
    withLimit?: string
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
    withLimit?: string
  ): Promise<Record<string, string[]>> => {
    const interpolatedName = this.datasource.interpolateString(name);
    const range = this.datasource.getAdjustedInterval(timeRange);
    let urlParams: UrlParamsType = {
      ...range,
      'match[]': interpolatedName,
    };

    if (withLimit !== 'none') {
      urlParams = { ...urlParams, limit: withLimit ?? DEFAULT_SERIES_LIMIT };
    }

    const data = await this.request(API_V1.SERIES, [], urlParams, getDefaultCacheHeaders(this.datasource.cacheLevel));
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
    withLimit?: string
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
      [],
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
    return await this.request(API_V1.SERIES, {}, params, getDefaultCacheHeaders(this.datasource.cacheLevel));
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
  const tokens = Prism.tokenize(promQuery, PromqlSyntax);
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

/**
 * Removes quotes from a string if they exist.
 * Used to handle utf8 label keys in Prometheus queries.
 *
 * @param {string} input - Input string that may have surrounding quotes
 * @returns {string} String with surrounding quotes removed if they existed
 */
export function removeQuotesIfExist(input: string): string {
  const match = input.match(/^"(.*)"$/); // extract the content inside the quotes
  return match?.[1] ?? input;
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
