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
  fixSummariesMetadata,
  getClientCacheDurationInMinutes,
  getRangeSnapInterval,
  processHistogramMetrics,
  processSeries,
} from './language_utils';
import { buildVisualQueryFromString } from './querybuilder/parsing';
import { DEFAULT_SERIES_LIMIT, METRICS_LABEL_KEY, PrometheusCacheLevel, PromMetricsMetadata, PromQuery } from './types';
import { escapeForUtf8Support, isValidLegacyName } from './utf8_support';

const API_V1 = {
  METADATA: '/api/v1/metadata',
  SERIES: '/api/v1/series',
  LABELS: '/api/v1/labels',
  LABELS_VALUES: (labelKey: string) => `/api/v1/labels/${labelKey}/values`,
};

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

  // TODO check if we need defaultValue and return it
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

  fetchLabelKeys = async (
    timeRange: TimeRange,
    queries?: PromQuery[],
    limit: string = DEFAULT_SERIES_LIMIT
  ): Promise<string[]> => {
    let url = API_V1.LABELS;
    const timeParams = getRangeSnapInterval(this.datasource.cacheLevel, timeRange);

    const searchParams = populateMatchParamsFromQueries(new URLSearchParams({ ...timeParams, limit }), queries);

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

  fetchLabelValues = async (
    timeRange: TimeRange,
    labelKey: string,
    limit: string = DEFAULT_SERIES_LIMIT
  ): Promise<string[]> => {
    const params = { ...this.datasource.getAdjustedInterval(timeRange), limit };
    const interpolatedName = this.datasource.interpolateString(labelKey);
    const interpolatedAndEscapedName = escapeForUtf8Support(removeQuotesIfExist(interpolatedName));
    const url = API_V1.LABELS_VALUES(interpolatedAndEscapedName);
    const value = await this.request(url, [], params, getDefaultCacheHeaders(this.datasource.cacheLevel));
    return value ?? [];
  };

  // ===================================
  // Series API
  // ===================================

  fetchSeries = async (
    timeRange: TimeRange,
    match: string,
    limit: string = DEFAULT_SERIES_LIMIT
  ): Promise<Array<Record<string, string>>> => {
    const range = this.datasource.getTimeRangeParams(timeRange);
    const params = { ...range, 'match[]': match, limit };
    return await this.request(API_V1.SERIES, {}, params, getDefaultCacheHeaders(this.datasource.cacheLevel));
  };

  getMetricsFromSeries = (series: Array<Record<string, string>>): string[] => {
    return series.map((s) => s.__name__);
  };

  getLabelKeysFromSeries = (series: Array<Record<string, string>>): string[] => {
    return series.map((s) => s.__name__);
  };

  getLabelValuesFromSeries = (series: Array<Record<string, string>>, labelKey: string): string[] => {
    return series.map((s) => s[labelKey]);
  };

  // ===================================
  // Suggestions API
  // ===================================

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

// Exporting utility functions for testing
export const isCancelledError = (error: unknown): error is { cancelled: boolean } => {
  return typeof error === 'object' && error !== null && 'cancelled' in error && error.cancelled === true;
};

// For utf8 labels we use quotes around the label
// While requesting the label values we must remove the quotes
export const removeQuotesIfExist = (input: string): string => {
  const match = input.match(/^"(.*)"$/); // extract the content inside the quotes
  return match?.[1] ?? input;
};

export const buildCacheHeaders = (durationInSeconds: number) => {
  return {
    headers: {
      'X-Grafana-Cache': `private, max-age=${durationInSeconds}`,
    },
  };
};

export const getDefaultCacheHeaders = (cacheLevel: PrometheusCacheLevel) => {
  if (cacheLevel !== PrometheusCacheLevel.None) {
    return buildCacheHeaders(getClientCacheDurationInMinutes(cacheLevel) * 60);
  }
  return;
};

export const populateMatchParamsFromQueries = (
  initialParams: URLSearchParams,
  queries?: PromQuery[]
): URLSearchParams => {
  return (queries ?? []).reduce((params, query) => {
    const visualQuery = buildVisualQueryFromString(query.expr);
    const isUtf8Metric = !isValidLegacyName(visualQuery.query.metric);
    params.append('match[]', isUtf8Metric ? `{"${visualQuery.query.metric}"}` : visualQuery.query.metric);
    if (visualQuery.query.binaryQueries) {
      visualQuery.query.binaryQueries.forEach((bq) => {
        params.append('match[]', isUtf8Metric ? `{"${bq.query.metric}"}` : bq.query.metric);
      });
    }
    return params;
  }, initialParams);
};
