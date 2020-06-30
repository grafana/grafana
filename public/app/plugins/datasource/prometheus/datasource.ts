// Libraries
import cloneDeep from 'lodash/cloneDeep';
import defaults from 'lodash/defaults';
import $ from 'jquery';
// Services & Utils
import kbn from 'app/core/utils/kbn';
import {
  AnnotationEvent,
  CoreApp,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataQueryResponseData,
  DataSourceApi,
  DataSourceInstanceSettings,
  dateMath,
  DateTime,
  LoadingState,
  ScopedVars,
  TimeRange,
  TimeSeries,
} from '@grafana/data';
import { forkJoin, from, merge, Observable, of } from 'rxjs';
import { filter, map, tap } from 'rxjs/operators';

import PrometheusMetricFindQuery from './metric_find_query';
import { ResultTransformer } from './result_transformer';
import PrometheusLanguageProvider from './language_provider';
import { getBackendSrv } from '@grafana/runtime';
import addLabelToQuery from './add_label_to_query';
import { getQueryHints } from './query_hints';
import { expandRecordingRules } from './language_utils';
// Types
import { PromOptions, PromQuery, PromQueryRequest } from './types';
import { safeStringifyValue } from 'app/core/utils/explore';
import templateSrv from 'app/features/templating/template_srv';
import { getTimeSrv } from 'app/features/dashboard/services/TimeSrv';
import TableModel from 'app/core/table_model';

export const ANNOTATION_QUERY_STEP_DEFAULT = '60s';

interface RequestOptions {
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  transformRequest?: (data: any) => string;
  data?: any;
  withCredentials?: boolean;
  silent?: boolean;
  requestId?: string;
}

export interface PromDataQueryResponse {
  data: {
    status: string;
    data: {
      resultType: string;
      results?: DataQueryResponseData[];
      result?: DataQueryResponseData[];
    };
  };
  cancelled?: boolean;
}

export interface PromLabelQueryResponse {
  data: {
    status: string;
    data: string[];
  };
  cancelled?: boolean;
}

export class PrometheusDatasource extends DataSourceApi<PromQuery, PromOptions> {
  type: string;
  editorSrc: string;
  ruleMappings: { [index: string]: string };
  url: string;
  directUrl: string;
  basicAuth: any;
  withCredentials: any;
  metricsNameCache: any;
  interval: string;
  queryTimeout: string;
  httpMethod: string;
  languageProvider: PrometheusLanguageProvider;
  lookupsDisabled: boolean;
  resultTransformer: ResultTransformer;
  customQueryParameters: any;

  constructor(instanceSettings: DataSourceInstanceSettings<PromOptions>) {
    super(instanceSettings);

    this.type = 'prometheus';
    this.editorSrc = 'app/features/prometheus/partials/query.editor.html';
    this.url = instanceSettings.url;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.interval = instanceSettings.jsonData.timeInterval || '15s';
    this.queryTimeout = instanceSettings.jsonData.queryTimeout;
    this.httpMethod = instanceSettings.jsonData.httpMethod || 'GET';
    this.directUrl = instanceSettings.jsonData.directUrl;
    this.resultTransformer = new ResultTransformer(templateSrv);
    this.ruleMappings = {};
    this.languageProvider = new PrometheusLanguageProvider(this);
    this.lookupsDisabled = instanceSettings.jsonData.disableMetricsLookup;
    this.customQueryParameters = new URLSearchParams(instanceSettings.jsonData.customQueryParameters);
  }

  init = () => {
    this.loadRules();
  };

  getQueryDisplayText(query: PromQuery) {
    return query.expr;
  }

  _addTracingHeaders(httpOptions: PromQueryRequest, options: DataQueryRequest<PromQuery>) {
    httpOptions.headers = {};
    const proxyMode = !this.url.match(/^http/);
    if (proxyMode) {
      httpOptions.headers['X-Dashboard-Id'] = options.dashboardId;
      httpOptions.headers['X-Panel-Id'] = options.panelId;
    }
  }

  _request(url: string, data: Record<string, string> = {}, options?: RequestOptions) {
    options = defaults(options || {}, {
      url: this.url + url,
      method: this.httpMethod,
      headers: {},
    });

    if (options.method === 'GET') {
      if (data && Object.keys(data).length) {
        options.url =
          options.url +
          '?' +
          Object.entries(data)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');
      }
    } else {
      options.headers['Content-Type'] = 'application/x-www-form-urlencoded';
      options.transformRequest = (data: any) => $.param(data);
      options.data = data;
    }

    if (this.basicAuth || this.withCredentials) {
      options.withCredentials = true;
    }

    if (this.basicAuth) {
      options.headers.Authorization = this.basicAuth;
    }

    return getBackendSrv().datasourceRequest(options as Required<RequestOptions>);
  }

  // Use this for tab completion features, wont publish response to other components
  metadataRequest(url: string) {
    return this._request(url, null, { method: 'GET', silent: true });
  }

  interpolateQueryExpr(value: string | string[] = [], variable: any) {
    // if no multi or include all do not regexEscape
    if (!variable.multi && !variable.includeAll) {
      return prometheusRegularEscape(value);
    }

    if (typeof value === 'string') {
      return prometheusSpecialRegexEscape(value);
    }

    const escapedValues = value.map(val => prometheusSpecialRegexEscape(val));
    return escapedValues.join('|');
  }

  targetContainsTemplate(target: PromQuery) {
    return templateSrv.variableExists(target.expr);
  }

  processResult = (response: any, query: PromQueryRequest, target: PromQuery, responseListLength: number) => {
    // Keeping original start/end for transformers
    const transformerOptions = {
      format: target.format,
      step: query.step,
      legendFormat: target.legendFormat,
      start: query.start,
      end: query.end,
      query: query.expr,
      responseListLength,
      refId: target.refId,
      valueWithRefId: target.valueWithRefId,
      meta: {
        /** Fix for showing of Prometheus results in Explore table. We want to show result of instant query in table and the rest of time series in graph */
        preferredVisualisationType: query.instant ? 'table' : 'graph',
      },
    };
    const series = this.resultTransformer.transform(response, transformerOptions);

    return series;
  };

  prepareTargets = (options: DataQueryRequest<PromQuery>, start: number, end: number) => {
    const queries: PromQueryRequest[] = [];
    const activeTargets: PromQuery[] = [];

    for (const target of options.targets) {
      if (!target.expr || target.hide) {
        continue;
      }

      target.requestId = options.panelId + target.refId;

      if (options.app !== CoreApp.Explore) {
        activeTargets.push(target);
        queries.push(this.createQuery(target, options, start, end));
        continue;
      }

      if (target.showingTable) {
        // create instant target only if Table is showed in Explore
        const instantTarget: any = cloneDeep(target);
        instantTarget.format = 'table';
        instantTarget.instant = true;
        instantTarget.valueWithRefId = true;
        delete instantTarget.maxDataPoints;
        instantTarget.requestId += '_instant';

        activeTargets.push(instantTarget);
        queries.push(this.createQuery(instantTarget, options, start, end));
      }

      if (target.showingGraph) {
        // create time series target only if Graph is showed in Explore
        target.format = 'time_series';
        target.instant = false;

        activeTargets.push(target);
        queries.push(this.createQuery(target, options, start, end));
      }
    }

    return {
      queries,
      activeTargets,
    };
  };

  query(options: DataQueryRequest<PromQuery>): Observable<DataQueryResponse> {
    const start = this.getPrometheusTime(options.range.from, false);
    const end = this.getPrometheusTime(options.range.to, true);
    const { queries, activeTargets } = this.prepareTargets(options, start, end);

    // No valid targets, return the empty result to save a round trip.
    if (!queries || !queries.length) {
      return of({
        data: [],
        state: LoadingState.Done,
      });
    }

    if (options.app === CoreApp.Explore) {
      return this.exploreQuery(queries, activeTargets, end);
    }

    return this.panelsQuery(queries, activeTargets, end, options.requestId);
  }

  private exploreQuery(queries: PromQueryRequest[], activeTargets: PromQuery[], end: number) {
    let runningQueriesCount = queries.length;
    const subQueries = queries.map((query, index) => {
      const target = activeTargets[index];
      let observable: Observable<any> = null;

      if (query.instant) {
        observable = from(this.performInstantQuery(query, end));
      } else {
        observable = from(this.performTimeSeriesQuery(query, query.start, query.end));
      }

      return observable.pipe(
        // Decrease the counter here. We assume that each request returns only single value and then completes
        // (should hold until there is some streaming requests involved).
        tap(() => runningQueriesCount--),
        filter((response: any) => (response.cancelled ? false : true)),
        map((response: any) => {
          const data = this.processResult(response, query, target, queries.length);
          return {
            data,
            key: query.requestId,
            state: runningQueriesCount === 0 ? LoadingState.Done : LoadingState.Loading,
          } as DataQueryResponse;
        })
      );
    });

    return merge(...subQueries);
  }

  private panelsQuery(queries: PromQueryRequest[], activeTargets: PromQuery[], end: number, requestId: string) {
    const observables: Array<Observable<Array<TableModel | TimeSeries>>> = queries.map((query, index) => {
      const target = activeTargets[index];
      let observable: Observable<any> = null;

      if (query.instant) {
        observable = from(this.performInstantQuery(query, end));
      } else {
        observable = from(this.performTimeSeriesQuery(query, query.start, query.end));
      }

      return observable.pipe(
        filter((response: any) => (response.cancelled ? false : true)),
        map((response: any) => {
          const data = this.processResult(response, query, target, queries.length);
          return data;
        })
      );
    });

    return forkJoin(observables).pipe(
      map((results: Array<Array<TableModel | TimeSeries>>) => {
        const data = results.reduce((result, current) => {
          return [...result, ...current];
        }, []);
        return {
          data,
          key: requestId,
          state: LoadingState.Done,
        };
      })
    );
  }

  createQuery(target: PromQuery, options: DataQueryRequest<PromQuery>, start: number, end: number) {
    const query: PromQueryRequest = {
      hinting: target.hinting,
      instant: target.instant,
      step: 0,
      expr: '',
      requestId: target.requestId,
      refId: target.refId,
      start: 0,
      end: 0,
    };
    const range = Math.ceil(end - start);

    // options.interval is the dynamically calculated interval
    let interval = kbn.interval_to_seconds(options.interval);
    // Minimum interval ("Min step"), if specified for the query or datasource. or same as interval otherwise
    const minInterval = kbn.interval_to_seconds(
      templateSrv.replace(target.interval, options.scopedVars) || options.interval
    );
    const intervalFactor = target.intervalFactor || 1;
    // Adjust the interval to take into account any specified minimum and interval factor plus Prometheus limits
    const adjustedInterval = this.adjustInterval(interval, minInterval, range, intervalFactor);
    let scopedVars = { ...options.scopedVars, ...this.getRangeScopedVars(options.range) };
    // If the interval was adjusted, make a shallow copy of scopedVars with updated interval vars
    if (interval !== adjustedInterval) {
      interval = adjustedInterval;
      scopedVars = Object.assign({}, options.scopedVars, {
        __interval: { text: interval + 's', value: interval + 's' },
        __interval_ms: { text: interval * 1000, value: interval * 1000 },
        ...this.getRangeScopedVars(options.range),
      });
    }
    query.step = interval;

    let expr = target.expr;

    // Apply adhoc filters
    const adhocFilters = templateSrv.getAdhocFilters(this.name);
    expr = adhocFilters.reduce((acc: string, filter: { key?: any; operator?: any; value?: any }) => {
      const { key, operator } = filter;
      let { value } = filter;
      if (operator === '=~' || operator === '!~') {
        value = prometheusRegularEscape(value);
      }
      return addLabelToQuery(acc, key, value, operator);
    }, expr);

    // Only replace vars in expression after having (possibly) updated interval vars
    query.expr = templateSrv.replace(expr, scopedVars, this.interpolateQueryExpr);

    // Align query interval with step to allow query caching and to ensure
    // that about-same-time query results look the same.
    const adjusted = alignRange(
      start,
      end,
      query.step,
      getTimeSrv()
        .timeRange()
        .to.utcOffset() * 60
    );
    query.start = adjusted.start;
    query.end = adjusted.end;
    this._addTracingHeaders(query, options);

    return query;
  }

  adjustInterval(interval: number, minInterval: number, range: number, intervalFactor: number) {
    // Prometheus will drop queries that might return more than 11000 data points.
    // Calculate a safe interval as an additional minimum to take into account.
    // Fractional safeIntervals are allowed, however serve little purpose if the interval is greater than 1
    // If this is the case take the ceil of the value.
    let safeInterval = range / 11000;
    if (safeInterval > 1) {
      safeInterval = Math.ceil(safeInterval);
    }
    return Math.max(interval * intervalFactor, minInterval, safeInterval);
  }

  performTimeSeriesQuery(query: PromQueryRequest, start: number, end: number) {
    if (start > end) {
      throw { message: 'Invalid time range' };
    }

    const url = '/api/v1/query_range';
    const data: any = {
      query: query.expr,
      start,
      end,
      step: query.step,
    };

    if (this.queryTimeout) {
      data['timeout'] = this.queryTimeout;
    }

    for (const [key, value] of this.customQueryParameters) {
      if (data[key] == null) {
        data[key] = value;
      }
    }

    return this._request(url, data, { requestId: query.requestId, headers: query.headers }).catch((err: any) => {
      if (err.cancelled) {
        return err;
      }

      throw this.handleErrors(err, query);
    });
  }

  performInstantQuery(query: PromQueryRequest, time: number) {
    const url = '/api/v1/query';
    const data: any = {
      query: query.expr,
      time,
    };

    if (this.queryTimeout) {
      data['timeout'] = this.queryTimeout;
    }

    for (const [key, value] of this.customQueryParameters) {
      if (data[key] == null) {
        data[key] = value;
      }
    }

    return this._request(url, data, { requestId: query.requestId, headers: query.headers }).catch((err: any) => {
      if (err.cancelled) {
        return err;
      }

      throw this.handleErrors(err, query);
    });
  }

  handleErrors = (err: any, target: PromQuery) => {
    const error: DataQueryError = {
      message: (err && err.statusText) || 'Unknown error during query transaction. Please check JS console logs.',
      refId: target.refId,
    };

    if (err.data) {
      if (typeof err.data === 'string') {
        error.message = err.data;
      } else if (err.data.error) {
        error.message = safeStringifyValue(err.data.error);
      }
    } else if (err.message) {
      error.message = err.message;
    } else if (typeof err === 'string') {
      error.message = err;
    }

    error.status = err.status;
    error.statusText = err.statusText;

    return error;
  };

  async performSuggestQuery(query: string, cache = false) {
    if (cache && this.metricsNameCache?.expire > Date.now()) {
      return this.metricsNameCache.data.filter((metricName: any) => metricName.indexOf(query) !== 1);
    }

    const response: PromLabelQueryResponse = await this.metadataRequest('/api/v1/label/__name__/values');
    this.metricsNameCache = {
      data: response.data.data,
      expire: Date.now() + 60 * 1000,
    };

    return response.data.data.filter(metricName => metricName.indexOf(query) !== 1);
  }

  metricFindQuery(query: string) {
    if (!query) {
      return Promise.resolve([]);
    }

    const scopedVars = {
      __interval: { text: this.interval, value: this.interval },
      __interval_ms: { text: kbn.interval_to_ms(this.interval), value: kbn.interval_to_ms(this.interval) },
      ...this.getRangeScopedVars(getTimeSrv().timeRange()),
    };
    const interpolated = templateSrv.replace(query, scopedVars, this.interpolateQueryExpr);
    const metricFindQuery = new PrometheusMetricFindQuery(this, interpolated);
    return metricFindQuery.process();
  }

  getRangeScopedVars(range: TimeRange = getTimeSrv().timeRange()) {
    const msRange = range.to.diff(range.from);
    const sRange = Math.round(msRange / 1000);
    return {
      __range_ms: { text: msRange, value: msRange },
      __range_s: { text: sRange, value: sRange },
      __range: { text: sRange + 's', value: sRange + 's' },
    };
  }

  createAnnotationQueryOptions = (options: any): DataQueryRequest<PromQuery> => {
    const annotation = options.annotation;
    const interval =
      annotation && annotation.step && typeof annotation.step === 'string'
        ? annotation.step
        : ANNOTATION_QUERY_STEP_DEFAULT;
    return {
      ...options,
      interval,
    };
  };

  async annotationQuery(options: any): Promise<AnnotationEvent[]> {
    const annotation = options.annotation;
    const { expr = '', tagKeys = '', titleFormat = '', textFormat = '' } = annotation;

    if (!expr) {
      return Promise.resolve([]);
    }

    const start = this.getPrometheusTime(options.range.from, false);
    const end = this.getPrometheusTime(options.range.to, true);
    const queryOptions = this.createAnnotationQueryOptions(options);

    // Unsetting min interval for accurate event resolution
    const minStep = '1s';
    const queryModel = {
      expr,
      interval: minStep,
      refId: 'X',
      requestId: `prom-query-${annotation.name}`,
    };

    const query = this.createQuery(queryModel, queryOptions, start, end);

    const self = this;
    const response: PromDataQueryResponse = await this.performTimeSeriesQuery(query, query.start, query.end);
    const eventList: AnnotationEvent[] = [];
    const splitKeys = tagKeys.split(',');

    if (response.cancelled) {
      return [];
    }

    const step = Math.floor(query.step) * 1000;

    response?.data?.data?.result?.forEach(series => {
      const tags = Object.entries(series.metric)
        .filter(([k]) => splitKeys.includes(k))
        .map(([_k, v]: [string, string]) => v);

      series.values.forEach((value: any[]) => {
        let timestampValue;
        // rewrite timeseries to a common format
        if (annotation.useValueForTime) {
          timestampValue = Math.floor(parseFloat(value[1]));
          value[1] = 1;
        } else {
          timestampValue = Math.floor(parseFloat(value[0])) * 1000;
        }
        value[0] = timestampValue;
      });

      const activeValues = series.values.filter((value: Record<number, string>) => parseFloat(value[1]) >= 1);
      const activeValuesTimestamps = activeValues.map((value: number[]) => value[0]);

      // Instead of creating singular annotation for each active event we group events into region if they are less
      // then `step` apart.
      let latestEvent: AnnotationEvent = null;
      activeValuesTimestamps.forEach((timestamp: number) => {
        // We already have event `open` and we have new event that is inside the `step` so we just update the end.
        if (latestEvent && latestEvent.timeEnd + step >= timestamp) {
          latestEvent.timeEnd = timestamp;
          return;
        }

        // Event exists but new one is outside of the `step` so we "finish" the current region.
        if (latestEvent) {
          eventList.push(latestEvent);
        }

        // We start a new region.
        latestEvent = {
          time: timestamp,
          timeEnd: timestamp,
          annotation,
          title: self.resultTransformer.renderTemplate(titleFormat, series.metric),
          tags,
          text: self.resultTransformer.renderTemplate(textFormat, series.metric),
        };
      });
      if (latestEvent) {
        // finish up last point if we have one
        latestEvent.timeEnd = activeValuesTimestamps[activeValuesTimestamps.length - 1];
        eventList.push(latestEvent);
      }
    });

    return eventList;
  }

  async getTagKeys() {
    const result = await this.metadataRequest('/api/v1/labels');
    return result?.data?.data?.map((value: any) => ({ text: value })) ?? [];
  }

  async getTagValues(options: any = {}) {
    const result = await this.metadataRequest(`/api/v1/label/${options.key}/values`);
    return result?.data?.data?.map((value: any) => ({ text: value })) ?? [];
  }

  async testDatasource() {
    const now = new Date().getTime();
    const query = { expr: '1+1' } as PromQueryRequest;
    const response = await this.performInstantQuery(query, now / 1000);
    return response.data.status === 'success'
      ? { status: 'success', message: 'Data source is working' }
      : { status: 'error', message: response.error };
  }

  interpolateVariablesInQueries(queries: PromQuery[], scopedVars: ScopedVars): PromQuery[] {
    let expandedQueries = queries;
    if (queries && queries.length) {
      expandedQueries = queries.map(query => {
        const expandedQuery = {
          ...query,
          datasource: this.name,
          expr: templateSrv.replace(query.expr, scopedVars, this.interpolateQueryExpr),
        };
        return expandedQuery;
      });
    }
    return expandedQueries;
  }

  getQueryHints(query: PromQuery, result: any[]) {
    return getQueryHints(query.expr ?? '', result, this);
  }

  async loadRules() {
    try {
      const res = await this.metadataRequest('/api/v1/rules');
      const body = res.data || res.json();

      const groups = body?.data?.groups;
      if (groups) {
        this.ruleMappings = extractRuleMappingFromGroups(groups);
      }
    } catch (e) {
      console.log('Rules API is experimental. Ignore next error.');
      console.error(e);
    }
  }

  modifyQuery(query: PromQuery, action: any): PromQuery {
    let expression = query.expr ?? '';
    switch (action.type) {
      case 'ADD_FILTER': {
        expression = addLabelToQuery(expression, action.key, action.value);
        break;
      }
      case 'ADD_FILTER_OUT': {
        expression = addLabelToQuery(expression, action.key, action.value, '!=');
        break;
      }
      case 'ADD_HISTOGRAM_QUANTILE': {
        expression = `histogram_quantile(0.95, sum(rate(${expression}[5m])) by (le))`;
        break;
      }
      case 'ADD_RATE': {
        expression = `rate(${expression}[5m])`;
        break;
      }
      case 'ADD_SUM': {
        expression = `sum(${expression.trim()}) by ($1)`;
        break;
      }
      case 'EXPAND_RULES': {
        if (action.mapping) {
          expression = expandRecordingRules(expression, action.mapping);
        }
        break;
      }
      default:
        break;
    }
    return { ...query, expr: expression };
  }

  getPrometheusTime(date: string | DateTime, roundUp: boolean) {
    if (typeof date === 'string') {
      date = dateMath.parse(date, roundUp);
    }

    return Math.ceil(date.valueOf() / 1000);
  }

  getTimeRange(): { start: number; end: number } {
    const range = getTimeSrv().timeRange();
    return {
      start: this.getPrometheusTime(range.from, false),
      end: this.getPrometheusTime(range.to, true),
    };
  }

  getOriginalMetricName(labelData: { [key: string]: string }) {
    return this.resultTransformer.getOriginalMetricName(labelData);
  }
}

/**
 * Align query range to step.
 * Rounds start and end down to a multiple of step.
 * @param start Timestamp marking the beginning of the range.
 * @param end Timestamp marking the end of the range.
 * @param step Interval to align start and end with.
 * @param utcOffsetSec Number of seconds current timezone is offset from UTC
 */
export function alignRange(
  start: number,
  end: number,
  step: number,
  utcOffsetSec: number
): { end: number; start: number } {
  const alignedEnd = Math.floor((end + utcOffsetSec) / step) * step - utcOffsetSec;
  const alignedStart = Math.floor((start + utcOffsetSec) / step) * step - utcOffsetSec;
  return {
    end: alignedEnd,
    start: alignedStart,
  };
}

export function extractRuleMappingFromGroups(groups: any[]) {
  return groups.reduce(
    (mapping, group) =>
      group.rules
        .filter((rule: any) => rule.type === 'recording')
        .reduce(
          (acc: { [key: string]: string }, rule: any) => ({
            ...acc,
            [rule.name]: rule.query,
          }),
          mapping
        ),
    {}
  );
}

export function prometheusRegularEscape(value: any) {
  return typeof value === 'string' ? value.replace(/'/g, "\\\\'") : value;
}

export function prometheusSpecialRegexEscape(value: any) {
  return typeof value === 'string'
    ? prometheusRegularEscape(value.replace(/\\/g, '\\\\\\\\').replace(/[$^*{}\[\]+?.()|]/g, '\\\\$&'))
    : value;
}
