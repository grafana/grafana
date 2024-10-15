import { defaults } from 'lodash';
import { lastValueFrom, Observable, throwError } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import semver from 'semver/preload';

import {
  AbstractQuery,
  AdHocVariableFilter,
  AnnotationEvent,
  AnnotationQueryRequest,
  CoreApp,
  DataFrame,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceGetTagKeysOptions,
  DataSourceGetTagValuesOptions,
  DataSourceInstanceSettings,
  DataSourceWithQueryExportSupport,
  DataSourceWithQueryImportSupport,
  // dateTime,// LOGZ.IO GRAFANA CHANGE :: Disable exemplars
  getDefaultTimeRange,
  LegacyMetricFindQueryOptions,
  MetricFindValue,
  QueryFixAction,
  rangeUtil,
  renderLegendFormat,
  ScopedVars,
  TimeRange,
} from '@grafana/data';
import {
  BackendDataSourceResponse,
  BackendSrvRequest,
  DataSourceWithBackend,
  FetchResponse,
  getBackendSrv,
  getTemplateSrv,
  isFetchError,
  TemplateSrv,
  toDataQueryResponse,
} from '@grafana/runtime';

import { addLabelToQuery } from './add_label_to_query';
import { AnnotationQueryEditor } from './components/AnnotationQueryEditor';
import PrometheusLanguageProvider from './language_provider';
import {
  expandRecordingRules,
  getClientCacheDurationInMinutes,
  getPrometheusTime,
  getRangeSnapInterval,
} from './language_utils';
import PrometheusMetricFindQuery from './metric_find_query';
import { getInitHints, getQueryHints } from './query_hints';
import { promQueryModeller } from './querybuilder/PromQueryModeller';
import { QueryBuilderLabelFilter, QueryEditorMode } from './querybuilder/shared/types';
import { CacheRequestInfo, defaultPrometheusQueryOverlapWindow, QueryCache } from './querycache/QueryCache';
import { getOriginalMetricName, transformV2 } from './result_transformer';
import { trackQuery } from './tracking';
import {
  ExemplarTraceIdDestination,
  PromApplication,
  PrometheusCacheLevel,
  PromOptions,
  PromQuery,
  PromQueryRequest,
} from './types';
import { PrometheusVariableSupport } from './variables';

const ANNOTATION_QUERY_STEP_DEFAULT = '60s';
const GET_AND_POST_METADATA_ENDPOINTS = ['api/v1/query', 'api/v1/query_range', 'api/v1/series', 'api/v1/labels'];

export const InstantQueryRefIdIndex = '-Instant';

export class PrometheusDatasource
  extends DataSourceWithBackend<PromQuery, PromOptions>
  implements DataSourceWithQueryImportSupport<PromQuery>, DataSourceWithQueryExportSupport<PromQuery>
{
  type: string;
  ruleMappings: { [index: string]: string };
  hasIncrementalQuery: boolean;
  url: string;
  id: number;
  access: 'direct' | 'proxy';
  basicAuth: any;
  withCredentials: any;
  interval: string;
  queryTimeout: string | undefined;
  httpMethod: string;
  languageProvider: PrometheusLanguageProvider;
  exemplarTraceIdDestinations: ExemplarTraceIdDestination[] | undefined;
  lookupsDisabled: boolean;
  customQueryParameters: any;
  datasourceConfigurationPrometheusFlavor?: PromApplication;
  datasourceConfigurationPrometheusVersion?: string;
  disableRecordingRules: boolean;
  defaultEditor?: QueryEditorMode;
  exemplarsAvailable: boolean;
  cacheLevel: PrometheusCacheLevel;
  cache: QueryCache<PromQuery>;

  constructor(
    instanceSettings: DataSourceInstanceSettings<PromOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv(),
    languageProvider?: PrometheusLanguageProvider
  ) {
    super(instanceSettings);

    this.type = 'prometheus';
    this.id = instanceSettings.id;
    this.url = instanceSettings.url!;
    this.access = instanceSettings.access;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.interval = instanceSettings.jsonData.timeInterval || '15s';
    this.queryTimeout = instanceSettings.jsonData.queryTimeout;
    this.httpMethod = instanceSettings.jsonData.httpMethod || 'GET';
    this.exemplarTraceIdDestinations = instanceSettings.jsonData.exemplarTraceIdDestinations;
    this.hasIncrementalQuery = instanceSettings.jsonData.incrementalQuerying ?? false;
    this.ruleMappings = {};
    this.languageProvider = languageProvider ?? new PrometheusLanguageProvider(this);
    this.lookupsDisabled = instanceSettings.jsonData.disableMetricsLookup ?? false;
    this.customQueryParameters = new URLSearchParams(instanceSettings.jsonData.customQueryParameters);
    this.datasourceConfigurationPrometheusFlavor = instanceSettings.jsonData.prometheusType;
    this.datasourceConfigurationPrometheusVersion = instanceSettings.jsonData.prometheusVersion;
    this.defaultEditor = instanceSettings.jsonData.defaultEditor;
    this.disableRecordingRules = instanceSettings.jsonData.disableRecordingRules ?? false;
    this.variables = new PrometheusVariableSupport(this, this.templateSrv);
    this.exemplarsAvailable = false; // LOGZ.IO GRAFANA CHANGE :: Disable exemplars
    this.cacheLevel = instanceSettings.jsonData.cacheLevel ?? PrometheusCacheLevel.Low;

    this.cache = new QueryCache({
      getTargetSignature: this.getPrometheusTargetSignature.bind(this),
      overlapString: instanceSettings.jsonData.incrementalQueryOverlapWindow ?? defaultPrometheusQueryOverlapWindow,
      profileFunction: this.getPrometheusProfileData.bind(this),
    });

    // This needs to be here and cannot be static because of how annotations typing affects casting of data source
    // objects to DataSourceApi types.
    // We don't use the default processing for prometheus.
    // See standardAnnotationSupport.ts/[shouldUseMappingUI|shouldUseLegacyRunner]
    this.annotations = {
      QueryEditor: AnnotationQueryEditor,
    };
  }

  init = async () => {
    if (!this.disableRecordingRules) {
      this.loadRules();
    }
    this.exemplarsAvailable = await this.areExemplarsAvailable();
  };

  getQueryDisplayText(query: PromQuery) {
    return query.expr;
  }

  getPrometheusProfileData(request: DataQueryRequest<PromQuery>, targ: PromQuery) {
    return {
      interval: targ.interval ?? request.interval,
      expr: this.interpolateString(targ.expr),
      datasource: 'Prometheus',
    };
  }

  /**
   * Get target signature for query caching
   * @param request
   * @param query
   */
  getPrometheusTargetSignature(request: DataQueryRequest<PromQuery>, query: PromQuery) {
    const targExpr = this.interpolateString(query.expr);
    return `${targExpr}|${query.interval ?? request.interval}|${JSON.stringify(request.rangeRaw ?? '')}|${
      query.exemplar
    }`;
  }

  hasLabelsMatchAPISupport(): boolean {
    return (
      // https://github.com/prometheus/prometheus/releases/tag/v2.24.0
      this._isDatasourceVersionGreaterOrEqualTo('2.24.0', PromApplication.Prometheus) ||
      // All versions of Mimir support matchers for labels API
      this._isDatasourceVersionGreaterOrEqualTo('2.0.0', PromApplication.Mimir) ||
      // https://github.com/cortexproject/cortex/discussions/4542
      this._isDatasourceVersionGreaterOrEqualTo('1.11.0', PromApplication.Cortex) ||
      // https://github.com/thanos-io/thanos/pull/3566
      //https://github.com/thanos-io/thanos/releases/tag/v0.18.0
      this._isDatasourceVersionGreaterOrEqualTo('0.18.0', PromApplication.Thanos)
    );
  }

  _isDatasourceVersionGreaterOrEqualTo(targetVersion: string, targetFlavor: PromApplication): boolean {
    // User hasn't configured flavor/version yet, default behavior is to not support features that require version configuration when not provided
    if (!this.datasourceConfigurationPrometheusVersion || !this.datasourceConfigurationPrometheusFlavor) {
      return false;
    }

    if (targetFlavor !== this.datasourceConfigurationPrometheusFlavor) {
      return false;
    }

    return semver.gte(this.datasourceConfigurationPrometheusVersion, targetVersion);
  }

  _addTracingHeaders(httpOptions: PromQueryRequest, options: DataQueryRequest<PromQuery>) {
    httpOptions.headers = {};
    if (this.access === 'proxy') {
      httpOptions.headers['X-Dashboard-UID'] = options.dashboardUID;
      httpOptions.headers['X-Panel-Id'] = options.panelId;
    }
  }

  directAccessError() {
    return throwError(
      () =>
        new Error(
          'Browser access mode in the Prometheus datasource is no longer available. Switch to server access mode.'
        )
    );
  }

  /**
   * Any request done from this data source should go through here as it contains some common processing for the
   * request. Any processing done here needs to be also copied on the backend as this goes through data source proxy
   * but not through the same code as alerting.
   */
  _request<T = unknown>(
    url: string,
    data: Record<string, string> | null,
    overrides: Partial<BackendSrvRequest> = {}
  ): Observable<FetchResponse<T>> {
    if (this.access === 'direct') {
      return this.directAccessError();
    }

    data = data || {};
    for (const [key, value] of this.customQueryParameters) {
      if (data[key] == null) {
        data[key] = value;
      }
    }

    let queryUrl = this.url + url;
    if (url.startsWith(`/api/datasources/uid/${this.uid}`)) {
      // This url is meant to be a replacement for the whole URL. Replace the entire URL
      queryUrl = url;
    }

    const options: BackendSrvRequest = defaults(overrides, {
      url: queryUrl,
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

  async importFromAbstractQueries(abstractQueries: AbstractQuery[]): Promise<PromQuery[]> {
    return abstractQueries.map((abstractQuery) => this.languageProvider.importFromAbstractQuery(abstractQuery));
  }

  async exportToAbstractQueries(queries: PromQuery[]): Promise<AbstractQuery[]> {
    return queries.map((query) => this.languageProvider.exportToAbstractQuery(query));
  }

  // Use this for tab completion features, wont publish response to other components
  async metadataRequest<T = any>(url: string, params = {}, options?: Partial<BackendSrvRequest>) {
    // If URL includes endpoint that supports POST and GET method, try to use configured method. This might fail as POST is supported only in v2.10+.
    if (GET_AND_POST_METADATA_ENDPOINTS.some((endpoint) => url.includes(endpoint))) {
      try {
        return await lastValueFrom(
          this._request<T>(`/api/datasources/uid/${this.uid}/resources${url}`, params, {
            method: this.httpMethod,
            hideFromInspector: true,
            showErrorAlert: false,
            ...options,
          })
        );
      } catch (err) {
        // If status code of error is Method Not Allowed (405) and HTTP method is POST, retry with GET
        if (this.httpMethod === 'POST' && isFetchError(err) && (err.status === 405 || err.status === 400)) {
          console.warn(`Couldn't use configured POST HTTP method for this request. Trying to use GET method instead.`);
        } else {
          throw err;
        }
      }
    }

    return await lastValueFrom(
      this._request<T>(`/api/datasources/uid/${this.uid}/resources${url}`, params, {
        method: 'GET',
        hideFromInspector: true,
        ...options,
      })
    ); // toPromise until we change getTagValues, getLabelNames to Observable
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
    return this.templateSrv.containsTemplate(target.expr);
  }

  shouldRunExemplarQuery(target: PromQuery, request: DataQueryRequest<PromQuery>): boolean {
    // LOGZ.IO GRAFANA CHANGE :: Disable exemplars
    // if (target.exemplar) {
    //   // We check all already processed targets and only create exemplar target for not used metric names
    //   const metricName = this.languageProvider.histogramMetrics.find((m) => target.expr.includes(m));
    //   // Remove targets that weren't processed yet (in targets array they are after current target)
    //   const currentTargetIdx = request.targets.findIndex((t) => t.refId === target.refId);
    //   const targets = request.targets.slice(0, currentTargetIdx).filter((t) => !t.hide);

    //   if (!metricName || (metricName && !targets.some((t) => t.expr.includes(metricName)))) {
    //     return true;
    //   }
    //   return false;
    // }
    return false;
  }

  processTargetV2(target: PromQuery, request: DataQueryRequest<PromQuery>) {
    const processedTargets: PromQuery[] = [];
    const processedTarget = {
      ...target,
      exemplar: this.shouldRunExemplarQuery(target, request),
      requestId: request.panelId + target.refId,
      // We need to pass utcOffsetSec to backend to calculate aligned range
      utcOffsetSec: request.range.to.utcOffset() * 60,
    };
    if (target.instant && target.range) {
      // We have query type "Both" selected
      // We should send separate queries with different refId
      processedTargets.push(
        {
          ...processedTarget,
          refId: processedTarget.refId,
          instant: false,
        },
        {
          ...processedTarget,
          refId: processedTarget.refId + InstantQueryRefIdIndex,
          range: false,
        }
      );
    } else {
      processedTargets.push(processedTarget);
    }

    return processedTargets;
  }

  query(request: DataQueryRequest<PromQuery>): Observable<DataQueryResponse> {
    if (this.access === 'direct') {
      return this.directAccessError();
    }

    let fullOrPartialRequest: DataQueryRequest<PromQuery>;
    let requestInfo: CacheRequestInfo<PromQuery> | undefined = undefined;
    const hasInstantQuery = request.targets.some((target) => target.instant);

    // Don't cache instant queries
    if (this.hasIncrementalQuery && !hasInstantQuery) {
      requestInfo = this.cache.requestInfo(request);
      fullOrPartialRequest = requestInfo.requests[0];
    } else {
      fullOrPartialRequest = request;
    }

    const targets = fullOrPartialRequest.targets.map((target) => this.processTargetV2(target, fullOrPartialRequest));
    const startTime = new Date();
    return super.query({ ...fullOrPartialRequest, targets: targets.flat() }).pipe(
      map((response) => {
        const amendedResponse = {
          ...response,
          data: this.cache.procFrames(request, requestInfo, response.data),
        };
        return transformV2(amendedResponse, request, {
          exemplarTraceIdDestinations: this.exemplarTraceIdDestinations,
        });
      }),
      tap((response: DataQueryResponse) => {
        trackQuery(response, request, startTime);
      })
    );
  }

  createQuery(target: PromQuery, options: DataQueryRequest<PromQuery>, start: number, end: number) {
    const query: PromQueryRequest = {
      hinting: target.hinting,
      instant: target.instant,
      exemplar: target.exemplar,
      step: 0,
      expr: '',
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
    expr = this.enhanceExprWithAdHocFilters(options.filters, expr);

    // Only replace vars in expression after having (possibly) updated interval vars
    query.expr = this.templateSrv.replace(expr, scopedVars, this.interpolateQueryExpr);

    // Align query interval with step to allow query caching and to ensure
    // that about-same-time query results look the same.
    const adjusted = alignRange(start, end, query.step, options.range.to.utcOffset() * 60);
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

  metricFindQuery(query: string, options?: LegacyMetricFindQueryOptions) {
    if (!query) {
      return Promise.resolve([]);
    }

    const scopedVars = {
      __interval: { text: this.interval, value: this.interval },
      __interval_ms: { text: rangeUtil.intervalToMs(this.interval), value: rangeUtil.intervalToMs(this.interval) },
      ...this.getRangeScopedVars(options?.range ?? getDefaultTimeRange()),
    };
    const interpolated = this.templateSrv.replace(query, scopedVars, this.interpolateQueryExpr);
    const metricFindQuery = new PrometheusMetricFindQuery(this, interpolated);
    return metricFindQuery.process(options?.range ?? getDefaultTimeRange());
  }

  getRangeScopedVars(range: TimeRange) {
    const msRange = range.to.diff(range.from);
    const sRange = Math.round(msRange / 1000);
    return {
      __range_ms: { text: msRange, value: msRange },
      __range_s: { text: sRange, value: sRange },
      __range: { text: sRange + 's', value: sRange + 's' },
    };
  }

  async annotationQuery(options: AnnotationQueryRequest<PromQuery>): Promise<AnnotationEvent[]> {
    if (this.access === 'direct') {
      const error = new Error(
        'Browser access mode in the Prometheus datasource is no longer available. Switch to server access mode.'
      );
      return Promise.reject(error);
    }

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
      refId: 'X',
      datasource: this.getRef(),
    };

    return await lastValueFrom(
      getBackendSrv()
        .fetch<BackendDataSourceResponse>({
          url: '/api/ds/query',
          method: 'POST',
          headers: this.getRequestHeaders(),
          data: {
            from: (getPrometheusTime(options.range.from, false) * 1000).toString(),
            to: (getPrometheusTime(options.range.to, true) * 1000).toString(),
            queries: [this.applyTemplateVariables(queryModel, {})],
          },
          requestId: `prom-query-${annotation.name}`,
        })
        .pipe(
          map((rsp: FetchResponse<BackendDataSourceResponse>) => {
            return this.processAnnotationResponse(options, rsp.data);
          })
        )
    );
  }

  processAnnotationResponse = (options: AnnotationQueryRequest<PromQuery>, data: BackendDataSourceResponse) => {
    const frames: DataFrame[] = toDataQueryResponse({ data: data }).data;
    if (!frames || !frames.length) {
      return [];
    }

    const annotation = options.annotation;
    const { tagKeys = '', titleFormat = '', textFormat = '' } = annotation;

    const step = rangeUtil.intervalToSeconds(annotation.step || ANNOTATION_QUERY_STEP_DEFAULT) * 1000;
    const tagKeysArray = tagKeys.split(',');

    const eventList: AnnotationEvent[] = [];

    for (const frame of frames) {
      if (frame.fields.length === 0) {
        continue;
      }
      const timeField = frame.fields[0];
      const valueField = frame.fields[1];
      const labels = valueField?.labels || {};

      const tags = Object.keys(labels)
        .filter((label) => tagKeysArray.includes(label))
        .map((label) => labels[label]);

      const timeValueTuple: Array<[number, number]> = [];

      let idx = 0;
      valueField.values.forEach((value: string) => {
        let timeStampValue: number;
        let valueValue: number;
        const time = timeField.values[idx];

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

      const activeValues = timeValueTuple.filter((value) => value[1] > 0);
      const activeValuesTimestamps = activeValues.map((value) => value[0]);

      // Instead of creating singular annotation for each active event we group events into region if they are less
      // or equal to `step` apart.
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
          title: renderLegendFormat(titleFormat, labels),
          tags,
          text: renderLegendFormat(textFormat, labels),
        };
      }

      if (latestEvent) {
        // Finish up last point if we have one
        latestEvent.timeEnd = activeValuesTimestamps[activeValuesTimestamps.length - 1];
        eventList.push(latestEvent);
      }
    }

    return eventList;
  };

  // By implementing getTagKeys and getTagValues we add ad-hoc filters functionality
  // this is used to get label keys, a.k.a label names
  // it is used in metric_find_query.ts
  // and in Tempo here grafana/public/app/plugins/datasource/tempo/QueryEditor/ServiceGraphSection.tsx
  async getTagKeys(options: DataSourceGetTagKeysOptions<PromQuery>): Promise<MetricFindValue[]> {
    if (!options || options.filters.length === 0) {
      await this.languageProvider.fetchLabels(options.timeRange);
      return this.languageProvider.getLabelKeys().map((k) => ({ value: k, text: k }));
    }

    const labelFilters: QueryBuilderLabelFilter[] = options.filters.map((f) => ({
      label: f.key,
      value: f.value,
      op: f.operator,
    }));
    const expr = promQueryModeller.renderLabels(labelFilters);

    let labelsIndex: Record<string, string[]> = await this.languageProvider.fetchLabelsWithMatch(expr);

    // filter out already used labels
    return Object.keys(labelsIndex)
      .filter((labelName) => !options.filters.find((filter) => filter.key === labelName))
      .map((k) => ({ value: k, text: k }));
  }

  // By implementing getTagKeys and getTagValues we add ad-hoc filters functionality
  async getTagValues(options: DataSourceGetTagValuesOptions) {
    const labelFilters: QueryBuilderLabelFilter[] = options.filters.map((f) => ({
      label: f.key,
      value: f.value,
      op: f.operator,
    }));

    const expr = promQueryModeller.renderLabels(labelFilters);

    if (this.hasLabelsMatchAPISupport()) {
      return (await this.languageProvider.fetchSeriesValuesWithMatch(options.key, expr, options.timeRange)).map(
        (v) => ({
          value: v,
          text: v,
        })
      );
    }

    const params = this.getTimeRangeParams(options.timeRange ?? getDefaultTimeRange());
    const result = await this.metadataRequest(`/api/v1/label/${options.key}/values`, params);
    return result?.data?.data?.map((value: any) => ({ text: value })) ?? [];
  }

  interpolateVariablesInQueries(
    queries: PromQuery[],
    scopedVars: ScopedVars,
    filters?: AdHocVariableFilter[]
  ): PromQuery[] {
    let expandedQueries = queries;
    if (queries && queries.length) {
      expandedQueries = queries.map((query) => {
        const interpolatedQuery = this.templateSrv.replace(query.expr, scopedVars, this.interpolateQueryExpr);
        const withAdhocFilters = this.enhanceExprWithAdHocFilters(filters, interpolatedQuery);

        const expandedQuery = {
          ...query,
          datasource: this.getRef(),
          expr: withAdhocFilters,
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
      // LOGZ.IO GRAFANA CHANGE :: DEV-46445-disable-recording-rules-fetch-in-grafana-10
      // const res = await this.metadataRequest('/api/v1/rules', {}, { showErrorAlert: false });
      // const groups = res.data?.data?.groups;
      const groups = null;

      if (groups) {
        this.ruleMappings = extractRuleMappingFromGroups(groups);
      }
    } catch (e) {
      console.log('Rules API is experimental. Ignore next error.');
      console.error(e);
    }
  }
  // LOGZ.IO GRAFANA CHANGE :: Disable exemplars
  async areExemplarsAvailable() {
    return false;
    // try {
    //   const res = await this.metadataRequest(
    //     '/api/v1/query_exemplars',
    //     {
    //       query: 'test',
    //       start: dateTime().subtract(30, 'minutes').valueOf().toString(),
    //       end: dateTime().valueOf().toString(),
    //     },
    //     {
    //       // Avoid alerting the user if this test fails
    //       showErrorAlert: false,
    //     }
    //   );
    //   if (res.data.status === 'success') {
    //     return true;
    //   }
    //   return false;
    // } catch (err) {
    //   return false;
    // }
  }

  modifyQuery(query: PromQuery, action: QueryFixAction): PromQuery {
    let expression = query.expr ?? '';
    switch (action.type) {
      case 'ADD_FILTER': {
        const { key, value } = action.options ?? {};
        if (key && value) {
          expression = addLabelToQuery(expression, key, value);
        }

        break;
      }
      case 'ADD_FILTER_OUT': {
        const { key, value } = action.options ?? {};
        if (key && value) {
          expression = addLabelToQuery(expression, key, value, '!=');
        }
        break;
      }
      case 'ADD_HISTOGRAM_QUANTILE': {
        expression = `histogram_quantile(0.95, sum(rate(${expression}[$__rate_interval])) by (le))`;
        break;
      }
      case 'ADD_RATE': {
        expression = `rate(${expression}[$__rate_interval])`;
        break;
      }
      case 'ADD_SUM': {
        expression = `sum(${expression.trim()}) by ($1)`;
        break;
      }
      case 'EXPAND_RULES': {
        if (action.options) {
          expression = expandRecordingRules(expression, action.options);
        }
        break;
      }
      default:
        break;
    }
    return { ...query, expr: expression };
  }

  /**
   * Returns the adjusted "snapped" interval parameters
   */
  getAdjustedInterval(timeRange: TimeRange): { start: string; end: string } {
    return getRangeSnapInterval(this.cacheLevel, timeRange);
  }

  /**
   * This will return a time range that always includes the users current time range,
   * and then a little extra padding to round up/down to the nearest nth minute,
   * defined by the result of the getCacheDurationInMinutes.
   *
   * For longer cache durations, and shorter query durations,
   * the window we're calculating might be much bigger then the user's current window,
   * resulting in us returning labels/values that might not be applicable for the given window,
   * this is a necessary trade-off if we want to cache larger durations
   */
  getTimeRangeParams(timeRange: TimeRange): { start: string; end: string } {
    return {
      start: getPrometheusTime(timeRange.from, false).toString(),
      end: getPrometheusTime(timeRange.to, true).toString(),
    };
  }

  getOriginalMetricName(labelData: { [key: string]: string }) {
    return getOriginalMetricName(labelData);
  }

  enhanceExprWithAdHocFilters(filters: AdHocVariableFilter[] | undefined, expr: string) {
    if (!filters || filters.length === 0) {
      return expr;
    }

    const finalQuery = filters.reduce((acc: string, filter: { key?: any; operator?: any; value?: any }) => {
      const { key, operator } = filter;
      let { value } = filter;
      if (operator === '=~' || operator === '!~') {
        value = prometheusRegularEscape(value);
      }
      return addLabelToQuery(acc, key, value, operator);
    }, expr);
    return finalQuery;
  }

  // Used when running queries through backend
  filterQuery(query: PromQuery): boolean {
    if (query.hide || !query.expr) {
      return false;
    }
    return true;
  }

  // Used when running queries through backend
  applyTemplateVariables(target: PromQuery, scopedVars: ScopedVars, filters?: AdHocVariableFilter[]) {
    const variables = { ...scopedVars };

    // We want to interpolate these variables on backend.
    // The pre-calculated values are replaced withe the variable strings.
    variables.__interval = {
      value: '$__interval',
    };
    variables.__interval_ms = {
      value: '$__interval_ms',
    };

    // interpolate expression
    const expr = this.templateSrv.replace(target.expr, variables, this.interpolateQueryExpr);

    // Add ad hoc filters
    const exprWithAdHocFilters = this.enhanceExprWithAdHocFilters(filters, expr);

    return {
      ...target,
      expr: exprWithAdHocFilters,
      interval: this.templateSrv.replace(target.interval, variables),
      legendFormat: this.templateSrv.replace(target.legendFormat, variables),
    };
  }

  getVariables(): string[] {
    return this.templateSrv.getVariables().map((v) => `$${v.name}`);
  }

  interpolateString(string: string, scopedVars?: ScopedVars) {
    return this.templateSrv.replace(string, scopedVars, this.interpolateQueryExpr);
  }

  getDebounceTimeInMilliseconds(): number {
    switch (this.cacheLevel) {
      case PrometheusCacheLevel.Medium:
        return 600;
      case PrometheusCacheLevel.High:
        return 1200;
      default:
        return 350;
    }
  }

  getDaysToCacheMetadata(): number {
    switch (this.cacheLevel) {
      case PrometheusCacheLevel.Medium:
        return 7;
      case PrometheusCacheLevel.High:
        return 30;
      default:
        return 1;
    }
  }

  getCacheDurationInMinutes(): number {
    return getClientCacheDurationInMinutes(this.cacheLevel);
  }

  getDefaultQuery(app: CoreApp): PromQuery {
    const defaults = {
      refId: 'A',
      expr: '',
      range: true,
      instant: false,
    };

    if (app === CoreApp.UnifiedAlerting) {
      return {
        ...defaults,
        instant: true,
        range: false,
      };
    }

    if (app === CoreApp.Explore) {
      return {
        ...defaults,
        instant: true,
        range: true,
      };
    }

    return defaults;
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
export function prometheusRegularEscape(value: unknown) {
  return typeof value === 'string' ? value.replace(/\\/g, '\\\\').replace(/'/g, "\\\\'") : value;
}

export function prometheusSpecialRegexEscape(value: unknown) {
  return typeof value === 'string' ? value.replace(/\\/g, '\\\\\\\\').replace(/[$^*{}\[\]\'+?.()|]/g, '\\\\$&') : value;
}
