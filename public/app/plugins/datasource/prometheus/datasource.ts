import { cloneDeep, defaults } from 'lodash';
import { forkJoin, lastValueFrom, merge, Observable, of, OperatorFunction, pipe, throwError } from 'rxjs';
import { catchError, filter, map, tap } from 'rxjs/operators';
import LRU from 'lru-cache';
import {
  AnnotationEvent,
  CoreApp,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  dateMath,
  DateTime,
  LoadingState,
  rangeUtil,
  ScopedVars,
  TimeRange,
  DataFrame,
} from '@grafana/data';
import {
  BackendSrvRequest,
  FetchError,
  FetchResponse,
  getBackendSrv,
  DataSourceWithBackend,
  BackendDataSourceResponse,
  toDataQueryResponse,
} from '@grafana/runtime';

import { safeStringifyValue } from 'app/core/utils/explore';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';
import addLabelToQuery from './add_label_to_query';
import PrometheusLanguageProvider from './language_provider';
import { expandRecordingRules } from './language_utils';
import { getInitHints, getQueryHints } from './query_hints';
import { getOriginalMetricName, renderTemplate, transform, transformV2 } from './result_transformer';
import {
  ExemplarTraceIdDestination,
  PromDataErrorResponse,
  PromDataSuccessResponse,
  PromExemplarData,
  PromMatrixData,
  PromOptions,
  PromQuery,
  PromQueryRequest,
  PromQueryType,
  PromScalarData,
  PromVectorData,
} from './types';
import { PrometheusVariableSupport } from './variables';
import PrometheusMetricFindQuery from './metric_find_query';

export const ANNOTATION_QUERY_STEP_DEFAULT = '60s';
const GET_AND_POST_METADATA_ENDPOINTS = ['api/v1/query', 'api/v1/query_range', 'api/v1/series', 'api/v1/labels'];

export class PrometheusDatasource extends DataSourceWithBackend<PromQuery, PromOptions> {
  type: string;
  editorSrc: string;
  ruleMappings: { [index: string]: string };
  url: string;
  id: number;
  directUrl: string;
  access: 'direct' | 'proxy';
  basicAuth: any;
  withCredentials: any;
  metricsNameCache = new LRU<string, string[]>(10);
  interval: string;
  queryTimeout: string | undefined;
  httpMethod: string;
  languageProvider: PrometheusLanguageProvider;
  exemplarTraceIdDestinations: ExemplarTraceIdDestination[] | undefined;
  lookupsDisabled: boolean;
  customQueryParameters: any;
  exemplarsAvailable: boolean;

  constructor(
    instanceSettings: DataSourceInstanceSettings<PromOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv(),
    private readonly timeSrv: TimeSrv = getTimeSrv()
  ) {
    super(instanceSettings);

    this.type = 'prometheus';
    this.editorSrc = 'app/features/prometheus/partials/query.editor.html';
    this.id = instanceSettings.id;
    this.url = instanceSettings.url!;
    this.access = instanceSettings.access;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.interval = instanceSettings.jsonData.timeInterval || '15s';
    this.queryTimeout = instanceSettings.jsonData.queryTimeout;
    this.httpMethod = instanceSettings.jsonData.httpMethod || 'POST';
    // `directUrl` is never undefined, we set it at https://github.com/grafana/grafana/blob/main/pkg/api/frontendsettings.go#L108
    // here we "fall back" to this.url to make typescript happy, but it should never happen
    this.directUrl = instanceSettings.jsonData.directUrl ?? this.url;
    this.exemplarTraceIdDestinations = instanceSettings.jsonData.exemplarTraceIdDestinations;
    this.ruleMappings = {};
    this.languageProvider = new PrometheusLanguageProvider(this);
    this.lookupsDisabled = instanceSettings.jsonData.disableMetricsLookup ?? false;
    this.customQueryParameters = new URLSearchParams(instanceSettings.jsonData.customQueryParameters);
    this.variables = new PrometheusVariableSupport(this, this.templateSrv, this.timeSrv);
    this.exemplarsAvailable = true;
  }

  init = async () => {
    this.loadRules();
    this.exemplarsAvailable = await this.areExemplarsAvailable();
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

  /**
   * Any request done from this data source should go through here as it contains some common processing for the
   * request. Any processing done here needs to be also copied on the backend as this goes through data source proxy
   * but not through the same code as alerting.
   */
  _request<T = any>(
    url: string,
    data: Record<string, string> | null,
    overrides: Partial<BackendSrvRequest> = {}
  ): Observable<FetchResponse<T>> {
    data = data || {};
    for (const [key, value] of this.customQueryParameters) {
      if (data[key] == null) {
        data[key] = value;
      }
    }

    const options: BackendSrvRequest = defaults(overrides, {
      url: this.url + url,
      method: this.httpMethod,
      headers: {},
    });

    if (options.method === 'GET') {
      if (data && Object.keys(data).length) {
        options.url =
          options.url +
          (options.url.search(/\?/) >= 0 ? '&' : '?') +
          Object.entries(data)
            .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
            .join('&');
      }
    } else {
      options.headers!['Content-Type'] = 'application/x-www-form-urlencoded';
      options.data = data;
    }

    if (this.basicAuth || this.withCredentials) {
      options.withCredentials = true;
    }

    if (this.basicAuth) {
      options.headers!.Authorization = this.basicAuth;
    }

    return getBackendSrv().fetch<T>(options);
  }

  // Use this for tab completion features, wont publish response to other components
  async metadataRequest<T = any>(url: string, params = {}) {
    // If URL includes endpoint that supports POST and GET method, try to use configured method. This might fail as POST is supported only in v2.10+.
    if (GET_AND_POST_METADATA_ENDPOINTS.some((endpoint) => url.includes(endpoint))) {
      try {
        return await lastValueFrom(
          this._request<T>(url, params, { method: this.httpMethod, hideFromInspector: true })
        );
      } catch (err) {
        // If status code of error is Method Not Allowed (405) and HTTP method is POST, retry with GET
        if (this.httpMethod === 'POST' && err.status === 405) {
          console.warn(`Couldn't use configured POST HTTP method for this request. Trying to use GET method instead.`);
        } else {
          throw err;
        }
      }
    }

    return await lastValueFrom(
      this._request<T>(url, params, { method: 'GET', hideFromInspector: true })
    ); // toPromise until we change getTagValues, getTagKeys to Observable
  }

  interpolateQueryExpr(value: string | string[] = [], variable: any) {
    // if no multi or include all do not regexEscape
    if (!variable.multi && !variable.includeAll) {
      return prometheusRegularEscape(value);
    }

    if (typeof value === 'string') {
      return prometheusSpecialRegexEscape(value);
    }

    const escapedValues = value.map((val) => prometheusSpecialRegexEscape(val));

    if (escapedValues.length === 1) {
      return escapedValues[0];
    }

    return '(' + escapedValues.join('|') + ')';
  }

  targetContainsTemplate(target: PromQuery) {
    return this.templateSrv.variableExists(target.expr);
  }

  prepareTargets = (options: DataQueryRequest<PromQuery>, start: number, end: number) => {
    const queries: PromQueryRequest[] = [];
    const activeTargets: PromQuery[] = [];
    const clonedTargets = cloneDeep(options.targets);

    for (const target of clonedTargets) {
      if (!target.expr || target.hide) {
        continue;
      }

      target.requestId = options.panelId + target.refId;
      const metricName = this.languageProvider.histogramMetrics.find((m) => target.expr.includes(m));

      // In Explore, we run both (instant and range) queries if both are true (selected) or both are undefined (legacy Explore queries)
      if (options.app === CoreApp.Explore && target.range === target.instant) {
        // Create instant target
        const instantTarget: any = cloneDeep(target);
        instantTarget.format = 'table';
        instantTarget.instant = true;
        instantTarget.range = false;
        instantTarget.valueWithRefId = true;
        delete instantTarget.maxDataPoints;
        instantTarget.requestId += '_instant';

        // Create range target
        const rangeTarget: any = cloneDeep(target);
        rangeTarget.format = 'time_series';
        rangeTarget.instant = false;
        instantTarget.range = true;

        // Create exemplar query
        if (target.exemplar) {
          // Only create exemplar target for different metric names
          if (
            !metricName ||
            (metricName && !activeTargets.some((activeTarget) => activeTarget.expr.includes(metricName)))
          ) {
            const exemplarTarget = cloneDeep(target);
            exemplarTarget.instant = false;
            exemplarTarget.requestId += '_exemplar';
            queries.push(this.createQuery(exemplarTarget, options, start, end));
            activeTargets.push(exemplarTarget);
          }
          instantTarget.exemplar = false;
          rangeTarget.exemplar = false;
        }

        // Add both targets to activeTargets and queries arrays
        activeTargets.push(instantTarget, rangeTarget);
        queries.push(
          this.createQuery(instantTarget, options, start, end),
          this.createQuery(rangeTarget, options, start, end)
        );
        // If running only instant query in Explore, format as table
      } else if (target.instant && options.app === CoreApp.Explore) {
        const instantTarget: any = cloneDeep(target);
        instantTarget.format = 'table';
        queries.push(this.createQuery(instantTarget, options, start, end));
        activeTargets.push(instantTarget);
      } else {
        // It doesn't make sense to query for exemplars in dashboard if only instant is selected
        if (target.exemplar && !target.instant) {
          if (
            !metricName ||
            (metricName && !activeTargets.some((activeTarget) => activeTarget.expr.includes(metricName)))
          ) {
            const exemplarTarget = cloneDeep(target);
            exemplarTarget.requestId += '_exemplar';
            queries.push(this.createQuery(exemplarTarget, options, start, end));
            activeTargets.push(exemplarTarget);
          }
          target.exemplar = false;
        }
        queries.push(this.createQuery(target, options, start, end));
        activeTargets.push(target);
      }
    }

    return {
      queries,
      activeTargets,
    };
  };

  shouldRunExemplarQuery(target: PromQuery): boolean {
    /* We want to run exemplar query only for histogram metrics:
    1. If we haven't processd histogram metrics yet, we need to check if expr includes "_bucket" which means that it is probably histogram metric (can rarely lead to false positive).
    2. If we have processed histogram metrics, check if it is part of query expr.
    */
    if (target.exemplar) {
      const histogramMetrics = this.languageProvider.histogramMetrics;

      if (histogramMetrics.length > 0) {
        return !!histogramMetrics.find((metric) => target.expr.includes(metric));
      } else {
        return target.expr.includes('_bucket');
      }
    }

    return false;
  }

  processTargetV2(target: PromQuery, request: DataQueryRequest<PromQuery>) {
    const processedTarget = {
      ...target,
      queryType: PromQueryType.timeSeriesQuery,
      exemplar: this.shouldRunExemplarQuery(target),
      requestId: request.panelId + target.refId,
      // We need to pass utcOffsetSec to backend to calculate aligned range
      utcOffsetSec: this.timeSrv.timeRange().to.utcOffset() * 60,
    };
    return processedTarget;
  }

  query(request: DataQueryRequest<PromQuery>): Observable<DataQueryResponse> {
    if (this.access === 'proxy') {
      const targets = request.targets.map((target) => this.processTargetV2(target, request));
      return super
        .query({ ...request, targets })
        .pipe(
          map((response) =>
            transformV2(response, request, { exemplarTraceIdDestinations: this.exemplarTraceIdDestinations })
          )
        );
      // Run queries trough browser/proxy
    } else {
      const start = this.getPrometheusTime(request.range.from, false);
      const end = this.getPrometheusTime(request.range.to, true);
      const { queries, activeTargets } = this.prepareTargets(request, start, end);

      // No valid targets, return the empty result to save a round trip.
      if (!queries || !queries.length) {
        return of({
          data: [],
          state: LoadingState.Done,
        });
      }

      if (request.app === CoreApp.Explore) {
        return this.exploreQuery(queries, activeTargets, end);
      }

      return this.panelsQuery(queries, activeTargets, end, request.requestId, request.scopedVars);
    }
  }

  private exploreQuery(queries: PromQueryRequest[], activeTargets: PromQuery[], end: number) {
    let runningQueriesCount = queries.length;

    const subQueries = queries.map((query, index) => {
      const target = activeTargets[index];

      const filterAndMapResponse = pipe(
        // Decrease the counter here. We assume that each request returns only single value and then completes
        // (should hold until there is some streaming requests involved).
        tap(() => runningQueriesCount--),
        filter((response: any) => (response.cancelled ? false : true)),
        map((response: any) => {
          const data = transform(response, {
            query,
            target,
            responseListLength: queries.length,
            exemplarTraceIdDestinations: this.exemplarTraceIdDestinations,
          });
          return {
            data,
            key: query.requestId,
            state: runningQueriesCount === 0 ? LoadingState.Done : LoadingState.Loading,
          } as DataQueryResponse;
        })
      );

      return this.runQuery(query, end, filterAndMapResponse);
    });

    return merge(...subQueries);
  }

  private panelsQuery(
    queries: PromQueryRequest[],
    activeTargets: PromQuery[],
    end: number,
    requestId: string,
    scopedVars: ScopedVars
  ) {
    const observables = queries.map((query, index) => {
      const target = activeTargets[index];

      const filterAndMapResponse = pipe(
        filter((response: any) => (response.cancelled ? false : true)),
        map((response: any) => {
          const data = transform(response, {
            query,
            target,
            responseListLength: queries.length,
            scopedVars,
            exemplarTraceIdDestinations: this.exemplarTraceIdDestinations,
          });
          return data;
        })
      );

      return this.runQuery(query, end, filterAndMapResponse);
    });

    return forkJoin(observables).pipe(
      map((results) => {
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

  private runQuery<T>(query: PromQueryRequest, end: number, filter: OperatorFunction<any, T>): Observable<T> {
    if (query.instant) {
      return this.performInstantQuery(query, end).pipe(filter);
    }

    if (query.exemplar) {
      return this.getExemplars(query).pipe(
        catchError(() => {
          return of({
            data: [],
            state: LoadingState.Done,
          });
        }),
        filter
      );
    }

    return this.performTimeSeriesQuery(query, query.start, query.end).pipe(filter);
  }

  createQuery(target: PromQuery, options: DataQueryRequest<PromQuery>, start: number, end: number) {
    const query: PromQueryRequest = {
      hinting: target.hinting,
      instant: target.instant,
      exemplar: target.exemplar,
      step: 0,
      expr: '',
      requestId: target.requestId,
      refId: target.refId,
      start: 0,
      end: 0,
    };
    const range = Math.ceil(end - start);

    // options.interval is the dynamically calculated interval
    let interval: number = rangeUtil.intervalToSeconds(options.interval);
    // Minimum interval ("Min step"), if specified for the query, or same as interval otherwise.
    const minInterval = rangeUtil.intervalToSeconds(
      this.templateSrv.replace(target.interval || options.interval, options.scopedVars)
    );
    // Scrape interval as specified for the query ("Min step") or otherwise taken from the datasource.
    // Min step field can have template variables in it, make sure to replace it.
    const scrapeInterval = target.interval
      ? rangeUtil.intervalToSeconds(this.templateSrv.replace(target.interval, options.scopedVars))
      : rangeUtil.intervalToSeconds(this.interval);

    const intervalFactor = target.intervalFactor || 1;
    // Adjust the interval to take into account any specified minimum and interval factor plus Prometheus limits
    const adjustedInterval = this.adjustInterval(interval, minInterval, range, intervalFactor);
    let scopedVars = {
      ...options.scopedVars,
      ...this.getRangeScopedVars(options.range),
      ...this.getRateIntervalScopedVariable(adjustedInterval, scrapeInterval),
    };
    // If the interval was adjusted, make a shallow copy of scopedVars with updated interval vars
    if (interval !== adjustedInterval) {
      interval = adjustedInterval;
      scopedVars = Object.assign({}, options.scopedVars, {
        __interval: { text: interval + 's', value: interval + 's' },
        __interval_ms: { text: interval * 1000, value: interval * 1000 },
        ...this.getRateIntervalScopedVariable(interval, scrapeInterval),
        ...this.getRangeScopedVars(options.range),
      });
    }
    query.step = interval;

    let expr = target.expr;

    // Apply adhoc filters
    expr = this.enhanceExprWithAdHocFilters(expr);

    // Only replace vars in expression after having (possibly) updated interval vars
    query.expr = this.templateSrv.replace(expr, scopedVars, this.interpolateQueryExpr);

    // Align query interval with step to allow query caching and to ensure
    // that about-same-time query results look the same.
    const adjusted = alignRange(start, end, query.step, this.timeSrv.timeRange().to.utcOffset() * 60);
    query.start = adjusted.start;
    query.end = adjusted.end;
    this._addTracingHeaders(query, options);

    return query;
  }

  getRateIntervalScopedVariable(interval: number, scrapeInterval: number) {
    // Fall back to the default scrape interval of 15s if scrapeInterval is 0 for some reason.
    if (scrapeInterval === 0) {
      scrapeInterval = 15;
    }
    const rateInterval = Math.max(interval + scrapeInterval, 4 * scrapeInterval);
    return { __rate_interval: { text: rateInterval + 's', value: rateInterval + 's' } };
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

    return this._request<PromDataSuccessResponse<PromMatrixData>>(url, data, {
      requestId: query.requestId,
      headers: query.headers,
    }).pipe(
      catchError((err: FetchError<PromDataErrorResponse<PromMatrixData>>) => {
        if (err.cancelled) {
          return of(err);
        }

        return throwError(this.handleErrors(err, query));
      })
    );
  }

  performInstantQuery(
    query: PromQueryRequest,
    time: number
  ): Observable<FetchResponse<PromDataSuccessResponse<PromVectorData | PromScalarData>> | FetchError> {
    const url = '/api/v1/query';
    const data: any = {
      query: query.expr,
      time,
    };

    if (this.queryTimeout) {
      data['timeout'] = this.queryTimeout;
    }

    return this._request<PromDataSuccessResponse<PromVectorData | PromScalarData>>(url, data, {
      requestId: query.requestId,
      headers: query.headers,
    }).pipe(
      catchError((err: FetchError<PromDataErrorResponse<PromVectorData | PromScalarData>>) => {
        if (err.cancelled) {
          return of(err);
        }

        return throwError(this.handleErrors(err, query));
      })
    );
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

  metricFindQuery(query: string) {
    if (!query) {
      return Promise.resolve([]);
    }

    const scopedVars = {
      __interval: { text: this.interval, value: this.interval },
      __interval_ms: { text: rangeUtil.intervalToMs(this.interval), value: rangeUtil.intervalToMs(this.interval) },
      ...this.getRangeScopedVars(this.timeSrv.timeRange()),
    };
    const interpolated = this.templateSrv.replace(query, scopedVars, this.interpolateQueryExpr);
    const metricFindQuery = new PrometheusMetricFindQuery(this, interpolated);
    return metricFindQuery.process();
  }

  getRangeScopedVars(range: TimeRange = this.timeSrv.timeRange()) {
    const msRange = range.to.diff(range.from);
    const sRange = Math.round(msRange / 1000);
    return {
      __range_ms: { text: msRange, value: msRange },
      __range_s: { text: sRange, value: sRange },
      __range: { text: sRange + 's', value: sRange + 's' },
    };
  }

  async annotationQuery(options: any): Promise<AnnotationEvent[]> {
    const annotation = options.annotation;
    const { expr = '' } = annotation;

    if (!expr) {
      return Promise.resolve([]);
    }

    const step = options.annotation.step || ANNOTATION_QUERY_STEP_DEFAULT;
    const queryModel = {
      expr,
      range: true,
      instant: false,
      exemplar: false,
      interval: step,
      queryType: PromQueryType.timeSeriesQuery,
      refId: 'X',
      datasource: this.getRef(),
    };

    return await lastValueFrom(
      getBackendSrv()
        .fetch<BackendDataSourceResponse>({
          url: '/api/ds/query',
          method: 'POST',
          data: {
            from: (this.getPrometheusTime(options.range.from, false) * 1000).toString(),
            to: (this.getPrometheusTime(options.range.to, true) * 1000).toString(),
            queries: [queryModel],
          },
          requestId: `prom-query-${annotation.name}`,
        })
        .pipe(
          map((rsp: FetchResponse<BackendDataSourceResponse>) => {
            return this.processsAnnotationResponse(options, rsp.data);
          })
        )
    );
  }

  processsAnnotationResponse = (options: any, data: BackendDataSourceResponse) => {
    const frames: DataFrame[] = toDataQueryResponse({ data: data }).data;
    if (!frames || !frames.length) {
      return [];
    }

    const annotation = options.annotation;
    const { tagKeys = '', titleFormat = '', textFormat = '' } = annotation;

    const step = rangeUtil.intervalToSeconds(annotation.step || ANNOTATION_QUERY_STEP_DEFAULT) * 1000;
    const tagKeysArray = tagKeys.split(',');
    const frame = frames[0];
    const timeField = frame.fields[0];
    const valueField = frame.fields[1];
    const labels = valueField?.labels || {};

    const tags = Object.keys(labels)
      .filter((label) => tagKeysArray.includes(label))
      .map((label) => labels[label]);

    const timeValueTuple: Array<[number, number]> = [];

    let idx = 0;
    valueField.values.toArray().forEach((value: string) => {
      let timeStampValue: number;
      let valueValue: number;
      const time = timeField.values.get(idx);

      // If we want to use value as a time, we use value as timeStampValue and valueValue will be 1
      if (options.annotation.useValueForTime) {
        timeStampValue = Math.floor(parseFloat(value));
        valueValue = 1;
      } else {
        timeStampValue = Math.floor(parseFloat(time));
        valueValue = parseFloat(value);
      }

      idx++;
      timeValueTuple.push([timeStampValue, valueValue]);
    });

    const activeValues = timeValueTuple.filter((value) => value[1] >= 1);
    const activeValuesTimestamps = activeValues.map((value) => value[0]);

    // Instead of creating singular annotation for each active event we group events into region if they are less
    // or equal to `step` apart.
    const eventList: AnnotationEvent[] = [];
    let latestEvent: AnnotationEvent | null = null;

    for (const timestamp of activeValuesTimestamps) {
      // We already have event `open` and we have new event that is inside the `step` so we just update the end.
      if (latestEvent && (latestEvent.timeEnd ?? 0) + step >= timestamp) {
        latestEvent.timeEnd = timestamp;
        continue;
      }

      // Event exists but new one is outside of the `step` so we add it to eventList.
      if (latestEvent) {
        eventList.push(latestEvent);
      }

      // We start a new region.
      latestEvent = {
        time: timestamp,
        timeEnd: timestamp,
        annotation,
        title: renderTemplate(titleFormat, labels),
        tags,
        text: renderTemplate(textFormat, labels),
      };
    }

    if (latestEvent) {
      // Finish up last point if we have one
      latestEvent.timeEnd = activeValuesTimestamps[activeValuesTimestamps.length - 1];
      eventList.push(latestEvent);
    }

    return eventList;
  };

  getExemplars(query: PromQueryRequest) {
    const url = '/api/v1/query_exemplars';
    return this._request<PromDataSuccessResponse<PromExemplarData>>(
      url,
      { query: query.expr, start: query.start.toString(), end: query.end.toString() },
      { requestId: query.requestId, headers: query.headers }
    );
  }

  async getTagKeys() {
    const result = await this.metadataRequest('/api/v1/labels');
    return result?.data?.data?.map((value: any) => ({ text: value })) ?? [];
  }

  async getTagValues(options: { key?: string } = {}) {
    const result = await this.metadataRequest(`/api/v1/label/${options.key}/values`);
    return result?.data?.data?.map((value: any) => ({ text: value })) ?? [];
  }

  async testDatasource() {
    const now = new Date().getTime();
    const query = { expr: '1+1' } as PromQueryRequest;
    const response = await lastValueFrom(this.performInstantQuery(query, now / 1000));
    return response.data.status === 'success'
      ? { status: 'success', message: 'Data source is working' }
      : { status: 'error', message: response.data.error };
  }

  interpolateVariablesInQueries(queries: PromQuery[], scopedVars: ScopedVars): PromQuery[] {
    let expandedQueries = queries;
    if (queries && queries.length) {
      expandedQueries = queries.map((query) => {
        const expandedQuery = {
          ...query,
          datasource: this.getRef(),
          expr: this.templateSrv.replace(query.expr, scopedVars, this.interpolateQueryExpr),
          interval: this.templateSrv.replace(query.interval, scopedVars),
        };
        return expandedQuery;
      });
    }
    return expandedQueries;
  }

  getQueryHints(query: PromQuery, result: any[]) {
    return getQueryHints(query.expr ?? '', result, this);
  }

  getInitHints() {
    return getInitHints(this);
  }

  async loadRules() {
    try {
      const res = await this.metadataRequest('/api/v1/rules');
      const groups = res.data?.data?.groups;

      if (groups) {
        this.ruleMappings = extractRuleMappingFromGroups(groups);
      }
    } catch (e) {
      console.log('Rules API is experimental. Ignore next error.');
      console.error(e);
    }
  }

  async areExemplarsAvailable() {
    try {
      const res = await this.metadataRequest('/api/v1/query_exemplars', { query: 'test' });
      if (res.data.status === 'success') {
        return true;
      }
      return false;
    } catch (err) {
      return false;
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
      date = dateMath.parse(date, roundUp)!;
    }

    return Math.ceil(date.valueOf() / 1000);
  }

  getTimeRangeParams(): { start: string; end: string } {
    const range = this.timeSrv.timeRange();
    return {
      start: this.getPrometheusTime(range.from, false).toString(),
      end: this.getPrometheusTime(range.to, true).toString(),
    };
  }

  getOriginalMetricName(labelData: { [key: string]: string }) {
    return getOriginalMetricName(labelData);
  }

  enhanceExprWithAdHocFilters(expr: string) {
    const adhocFilters = this.templateSrv.getAdhocFilters(this.name);
    let finalQuery = expr;
    finalQuery = adhocFilters.reduce((acc: string, filter: { key?: any; operator?: any; value?: any }) => {
      const { key, operator } = filter;
      let { value } = filter;
      if (operator === '=~' || operator === '!~') {
        value = prometheusRegularEscape(value);
      }
      return addLabelToQuery(acc, key, value, operator);
    }, finalQuery);
    return finalQuery;
  }

  // Used when running queries trough backend
  filterQuery(query: PromQuery): boolean {
    if (query.hide || !query.expr) {
      return false;
    }
    return true;
  }

  // Used when running queries trough backend
  applyTemplateVariables(target: PromQuery, scopedVars: ScopedVars): Record<string, any> {
    const variables = cloneDeep(scopedVars);

    // We want to interpolate these variables on backend
    delete variables.__interval;
    delete variables.__interval_ms;

    //Add ad hoc filters
    const expr = this.enhanceExprWithAdHocFilters(target.expr);

    return {
      ...target,
      legendFormat: this.templateSrv.replace(target.legendFormat, variables),
      expr: this.templateSrv.replace(expr, variables, this.interpolateQueryExpr),
    };
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

// NOTE: these two functions are very similar to the escapeLabelValueIn* functions
// in language_utils.ts, but they are not exactly the same algorithm, and we found
// no way to reuse one in the another or vice versa.
export function prometheusRegularEscape(value: any) {
  return typeof value === 'string' ? value.replace(/\\/g, '\\\\').replace(/'/g, "\\\\'") : value;
}

export function prometheusSpecialRegexEscape(value: any) {
  return typeof value === 'string' ? value.replace(/\\/g, '\\\\\\\\').replace(/[$^*{}\[\]\'+?.()|]/g, '\\\\$&') : value;
}
