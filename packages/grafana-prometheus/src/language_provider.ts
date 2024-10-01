// Core Grafana history https://github.com/grafana/grafana/blob/v11.0.0-preview/public/app/plugins/datasource/prometheus/language_provider.ts
import { once } from 'lodash';
import Prism from 'prismjs';

import {
  AbstractLabelMatcher,
  AbstractLabelOperator,
  AbstractQuery,
  getDefaultTimeRange,
  LanguageProvider,
  MetricFindValue,
  TimeRange,
} from '@grafana/data';
import { BackendSrvRequest } from '@grafana/runtime';

import { DEFAULT_SERIES_LIMIT, REMOVE_SERIES_LIMIT } from './components/PrometheusMetricsBrowser';
import { Label } from './components/monaco-query-field/monaco-completion-provider/situation';
import { PrometheusDatasource } from './datasource';
import {
  extractLabelMatchers,
  fixSummariesMetadata,
  processHistogramMetrics,
  processLabels,
  toPromLikeQuery,
} from './language_utils';
import PromqlSyntax from './promql';
import { buildVisualQueryFromString } from './querybuilder/parsing';
import { PrometheusCacheLevel, PromMetricsMetadata, PromQuery } from './types';

const DEFAULT_KEYS = ['job', 'instance'];
const EMPTY_SELECTOR = '{}';
// Max number of items (metrics, labels, values) that we display as suggestions. Prevents from running out of memory.
export const SUGGESTIONS_LIMIT = 10000;

type UrlParamsType = {
  start?: string;
  end?: string;
  'match[]'?: string;
  limit?: string;
};

const buildCacheHeaders = (durationInSeconds: number) => {
  return {
    headers: {
      'X-Grafana-Cache': `private, max-age=${durationInSeconds}`,
    },
  };
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

const PREFIX_DELIMITER_REGEX =
  /(="|!="|=~"|!~"|\{|\[|\(|\+|-|\/|\*|%|\^|\band\b|\bor\b|\bunless\b|==|>=|!=|<=|>|<|=|~|,)/;

const secondsInDay = 86400;
export default class PromQlLanguageProvider extends LanguageProvider {
  histogramMetrics: string[];
  timeRange: TimeRange;
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
    this.timeRange = getDefaultTimeRange();
    this.metrics = [];

    Object.assign(this, initialValues);
  }

  getDefaultCacheHeaders() {
    if (this.datasource.cacheLevel !== PrometheusCacheLevel.None) {
      return buildCacheHeaders(this.datasource.getCacheDurationInMinutes() * 60);
    }
    return;
  }

  // Strip syntax chars so that typeahead suggestions can work on clean inputs
  cleanText(s: string) {
    const parts = s.split(PREFIX_DELIMITER_REGEX);
    const last = parts.pop()!;
    return last.trimLeft().replace(/"$/, '').replace(/^"/, '');
  }

  get syntax() {
    return PromqlSyntax;
  }

  request = async (url: string, defaultValue: any, params = {}, options?: Partial<BackendSrvRequest>) => {
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

  start = async (timeRange?: TimeRange): Promise<any[]> => {
    this.timeRange = timeRange ?? getDefaultTimeRange();

    if (this.datasource.lookupsDisabled) {
      return [];
    }

    this.metrics = (await this.fetchLabelValues('__name__')) || [];
    this.histogramMetrics = processHistogramMetrics(this.metrics).sort();
    return Promise.all([this.loadMetricsMetadata(), this.fetchLabels()]);
  };

  /**
   * Only used for getting metrics from a data source that
   * supports the match[] parameter
   * where we can get a list of metrics based on user input
   * that is passed to the label values endpoint
   * with the extra param to match on series that contain the input
   * as regex for the __name__ label
   *
   * Also takes a limit param to limit the number of metrics returned
   *
   * @param metricRegex
   * @param limit
   * @returns
   */
  async getLimitedMetrics(metricRegex: string): Promise<string[]> {
    const limit = this.datasource.metricNamesAutocompleteSuggestionLimit.toString();

    const options = {
      key: '__name__',
      filters: [{ key: '__name__', value: '.*' + metricRegex + '.*', operator: '=~' }],
      limit,
    };
    const metricNames = await this.datasource.getTagValues(options);
    // metrics should only be strings but MetricFindValue from getTagKeys is a (string|number|undefined)
    if (metricNames.every((el: MetricFindValue) => typeof el.value === 'string')) {
      return metricNames.map((m: { text: string }) => m.text);
    }

    return [];
  }

  async loadMetricsMetadata() {
    const headers = buildCacheHeaders(this.datasource.getDaysToCacheMetadata() * secondsInDay);
    this.metricsMetadata = fixSummariesMetadata(
      await this.request(
        '/api/v1/metadata',
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

  importFromAbstractQuery(labelBasedQuery: AbstractQuery): PromQuery {
    return toPromLikeQuery(labelBasedQuery);
  }

  exportToAbstractQuery(query: PromQuery): AbstractQuery {
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
  }

  async getSeries(selector: string, withName?: boolean): Promise<Record<string, string[]>> {
    if (this.datasource.lookupsDisabled) {
      return {};
    }
    try {
      if (selector === EMPTY_SELECTOR) {
        return await this.fetchDefaultSeries();
      } else {
        return await this.fetchSeriesLabels(selector, withName, REMOVE_SERIES_LIMIT);
      }
    } catch (error) {
      // TODO: better error handling
      console.error(error);
      return {};
    }
  }

  /**
   * Used to fetch label values and to fetch metrics with the label key __name__
   * Used in
   * - languageProvider.start()
   * - languageProvider.getLabelValues()
   * - languageProvider.fetchDefaultSeries()
   *
   * @param key
   */
  fetchLabelValues = async (key: string, fromQueryBuilder?: boolean): Promise<string[]> => {
    let params: UrlParamsType = this.datasource.getAdjustedInterval(this.timeRange);

    // Do not limit the query builder metric suggestions
    // Limit metrics from the code editor and metrics browser
    // metric names come from the label __name__
    if (!fromQueryBuilder && this.datasource.metricNamesAutocompleteSuggestionLimit && key === '__name__') {
      const limit = this.datasource.metricNamesAutocompleteSuggestionLimit.toString();
      // add limit to the params
      params = { ...params, limit };
    }

    const interpolatedName = this.datasource.interpolateString(key);
    const url = `/api/v1/label/${interpolatedName}/values`;
    const value = await this.request(url, [], params, this.getDefaultCacheHeaders());
    return value ?? [];
  };

  /**
   * This function is used to retrieve label values in completions.ts in Monaco editor
   * and used for general label values in the query builder
   * Extra: it is also used in the query builder to load initial metrics when there are no label filters
   *
   * @param key
   * @param fromQueryBuilder
   * @returns
   */
  async getLabelValues(key: string, fromQueryBuilder?: boolean): Promise<string[]> {
    return await this.fetchLabelValues(key, fromQueryBuilder);
  }

  /**
   * Fetches all label keys
   */
  fetchLabels = async (timeRange?: TimeRange, queries?: PromQuery[]): Promise<string[]> => {
    if (timeRange) {
      this.timeRange = timeRange;
    }
    let url = '/api/v1/labels';
    const timeParams = this.datasource.getAdjustedInterval(this.timeRange);
    this.labelFetchTs = Date.now().valueOf();

    const searchParams = new URLSearchParams({ ...timeParams });
    queries?.forEach((q) => {
      const visualQuery = buildVisualQueryFromString(q.expr);
      if (visualQuery.query.metric !== '') {
        searchParams.append('match[]', visualQuery.query.metric);
        if (visualQuery.query.binaryQueries) {
          visualQuery.query.binaryQueries.forEach((bq) => {
            searchParams.append('match[]', bq.query.metric);
          });
        }
      }
    });

    if (this.datasource.httpMethod === 'GET') {
      url += `?${searchParams.toString()}`;
    }

    const res = await this.request(url, [], searchParams, this.getDefaultCacheHeaders());
    if (Array.isArray(res)) {
      this.labelKeys = res.slice().sort();
    }

    return [];
  };

  /**
   * Gets series values
   * Function to replace old getSeries calls in a way that will provide faster endpoints for new prometheus instances,
   * while maintaining backward compatability
   * @param labelName
   * @param selector
   */
  getSeriesValues = async (labelName: string, selector: string): Promise<string[]> => {
    if (!this.datasource.hasLabelsMatchAPISupport()) {
      const data = await this.getSeries(selector);
      return data[labelName] ?? [];
    }
    return await this.fetchSeriesValuesWithMatch(labelName, selector);
  };

  /**
   * Fetches all values for a label, with optional match[]
   * Used in the following locations
   * - datasource.getTagValues() for adhoc label values and metrics here languageProvider.getLimitedMetrics which calls getTagValues()
   * - languageProvider.getSeriesValues()
   * - MetricsLabelsSection.tsx, getLabelValuesFromLabelValuesAPI() for labels
   *
   * @param name
   * @param match
   * @param timeRange
   * @param requestId
   */
  fetchSeriesValuesWithMatch = async (
    name: string,
    match: string,
    requestId?: string,
    timeRange: TimeRange = this.timeRange
  ): Promise<string[]> => {
    const interpolatedName = name ? this.datasource.interpolateString(name) : null;
    const interpolatedMatch = match ? this.datasource.interpolateString(match) : null;
    const range = this.datasource.getAdjustedInterval(timeRange);
    let urlParams: UrlParamsType = {
      ...range,
      ...(interpolatedMatch && { 'match[]': interpolatedMatch }),
    };

    // only use the limit if calling for metrics and the limit has been set in the config
    if (this.datasource.metricNamesAutocompleteSuggestionLimit && interpolatedName === '__name__') {
      const limit = this.datasource.metricNamesAutocompleteSuggestionLimit.toString();
      urlParams = { ...urlParams, limit };
    }

    let requestOptions: Partial<BackendSrvRequest> | undefined = {
      ...this.getDefaultCacheHeaders(),
      ...(requestId && { requestId }),
    };

    if (!Object.keys(requestOptions).length) {
      requestOptions = undefined;
    }

    const value = await this.request(`/api/v1/label/${interpolatedName}/values`, [], urlParams, requestOptions);
    return value ?? [];
  };

  /**
   * Gets series labels
   * Function to replace old getSeries calls in a way that will provide faster endpoints for new prometheus instances,
   * while maintaining backward compatability. The old API call got the labels and the values in a single query,
   * but with the new query we need two calls, one to get the labels, and another to get the values.
   *
   * @param selector
   * @param otherLabels
   */
  getSeriesLabels = async (selector: string, otherLabels: Label[]): Promise<string[]> => {
    let possibleLabelNames, data: Record<string, string[]>;

    if (!this.datasource.hasLabelsMatchAPISupport()) {
      data = await this.getSeries(selector);
      possibleLabelNames = Object.keys(data); // all names from prometheus
    } else {
      // Exclude __name__ from output
      otherLabels.push({ name: '__name__', value: '', op: '!=' });
      data = await this.fetchSeriesLabelsMatch(selector);
      possibleLabelNames = Object.keys(data);
    }

    const usedLabelNames = new Set(otherLabels.map((l) => l.name)); // names used in the query
    return possibleLabelNames.filter((l) => !usedLabelNames.has(l));
  };

  /**
   * Fetch labels using the best endpoint that datasource supports.
   * This is cached by its args but also by the global timeRange currently selected as they can change over requested time.
   * @param name
   * @param withName
   */
  fetchLabelsWithMatch = async (name: string, withName?: boolean): Promise<Record<string, string[]>> => {
    if (this.datasource.hasLabelsMatchAPISupport()) {
      return this.fetchSeriesLabelsMatch(name, withName);
    } else {
      return this.fetchSeriesLabels(name, withName, REMOVE_SERIES_LIMIT);
    }
  };

  /**
   * Fetch labels for a series using /series endpoint. This is cached by its args but also by the global timeRange currently selected as
   * they can change over requested time.
   * @param name
   * @param withName
   * @param withLimit
   */
  fetchSeriesLabels = async (
    name: string,
    withName?: boolean,
    withLimit?: string
  ): Promise<Record<string, string[]>> => {
    const interpolatedName = this.datasource.interpolateString(name);
    const range = this.datasource.getAdjustedInterval(this.timeRange);
    let urlParams: UrlParamsType = {
      ...range,
      'match[]': interpolatedName,
    };

    if (withLimit !== 'none') {
      urlParams = { ...urlParams, limit: withLimit ?? DEFAULT_SERIES_LIMIT };
    }

    const url = `/api/v1/series`;

    const data = await this.request(url, [], urlParams, this.getDefaultCacheHeaders());
    const { values } = processLabels(data, withName);
    return values;
  };

  /**
   * Fetch labels for a series using /labels endpoint.  This is cached by its args but also by the global timeRange currently selected as
   * they can change over requested time.
   * @param name
   * @param withName
   */
  fetchSeriesLabelsMatch = async (name: string, withName?: boolean): Promise<Record<string, string[]>> => {
    const interpolatedName = this.datasource.interpolateString(name);
    const range = this.datasource.getAdjustedInterval(this.timeRange);
    const urlParams = {
      ...range,
      'match[]': interpolatedName,
    };
    const url = `/api/v1/labels`;

    const data: string[] = await this.request(url, [], urlParams, this.getDefaultCacheHeaders());
    // Convert string array to Record<string , []>
    return data.reduce((ac, a) => ({ ...ac, [a]: '' }), {});
  };

  /**
   * Fetch series for a selector. Use this for raw results. Use fetchSeriesLabels() to get labels.
   * @param match
   */
  fetchSeries = async (match: string): Promise<Array<Record<string, string>>> => {
    const url = '/api/v1/series';
    const range = this.datasource.getTimeRangeParams(this.timeRange);
    const params = { ...range, 'match[]': match };
    return await this.request(url, {}, params, this.getDefaultCacheHeaders());
  };

  /**
   * Fetch this only one as we assume this won't change over time. This is cached differently from fetchSeriesLabels
   * because we can cache more aggressively here and also we do not want to invalidate this cache the same way as in
   * fetchSeriesLabels.
   */
  fetchDefaultSeries = once(async () => {
    const values = await Promise.all(DEFAULT_KEYS.map((key) => this.fetchLabelValues(key)));
    return DEFAULT_KEYS.reduce((acc, key, i) => ({ ...acc, [key]: values[i] }), {});
  });
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

function isCancelledError(error: unknown): error is {
  cancelled: boolean;
} {
  return typeof error === 'object' && error !== null && 'cancelled' in error && error.cancelled === true;
}
