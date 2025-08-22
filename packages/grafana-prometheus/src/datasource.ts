import { defaults } from 'lodash';
import { tz } from 'moment-timezone';
import { lastValueFrom, Observable, throwError } from 'rxjs';
import { map, tap } from 'rxjs/operators';
import { gte } from 'semver';

import {
  AbstractQuery,
  AdHocVariableFilter,
  CoreApp,
  CustomVariableModel,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceGetTagKeysOptions,
  DataSourceGetTagValuesOptions,
  DataSourceInstanceSettings,
  DataSourceWithQueryExportSupport,
  DataSourceWithQueryImportSupport,
  dateTime,
  getDefaultTimeRange,
  LegacyMetricFindQueryOptions,
  MetricFindValue,
  QueryFixAction,
  QueryVariableModel,
  rangeUtil,
  ScopedVars,
  scopeFilterOperatorMap,
  ScopeSpecFilter,
  TimeRange,
} from '@grafana/data';
import {
  BackendSrvRequest,
  config,
  DataSourceWithBackend,
  FetchResponse,
  getBackendSrv,
  getTemplateSrv,
  isFetchError,
  TemplateSrv,
} from '@grafana/runtime';

import { addLabelToQuery } from './add_label_to_query';
import { PrometheusAnnotationSupport } from './annotations';
import {
  DEFAULT_SERIES_LIMIT,
  GET_AND_POST_METADATA_ENDPOINTS,
  InstantQueryRefIdIndex,
  SUGGESTIONS_LIMIT,
} from './constants';
import { interpolateQueryExpr, prometheusRegularEscape } from './escaping';
import {
  exportToAbstractQuery,
  importFromAbstractQuery,
  populateMatchParamsFromQueries,
  PrometheusLanguageProvider,
  PrometheusLanguageProviderInterface,
} from './language_provider';
import { expandRecordingRules, getPrometheusTime, getRangeSnapInterval } from './language_utils';
import { PrometheusMetricFindQuery } from './metric_find_query';
import { getQueryHints } from './query_hints';
import { renderLabelsWithoutBrackets } from './querybuilder/shared/rendering/labels';
import { QueryBuilderLabelFilter, QueryEditorMode } from './querybuilder/shared/types';
import { CacheRequestInfo, defaultPrometheusQueryOverlapWindow, QueryCache } from './querycache/QueryCache';
import { transformV2 } from './result_transformer';
import { trackQuery } from './tracking';
import {
  ExemplarTraceIdDestination,
  PromApplication,
  PrometheusCacheLevel,
  PromOptions,
  PromQuery,
  PromQueryRequest,
  RawRecordingRules,
  RuleQueryMapping,
} from './types';
import { utf8Support, wrapUtf8Filters } from './utf8_support';
import { PrometheusVariableSupport } from './variables';

export class PrometheusDatasource
  extends DataSourceWithBackend<PromQuery, PromOptions>
  implements DataSourceWithQueryImportSupport<PromQuery>, DataSourceWithQueryExportSupport<PromQuery>
{
  access: 'direct' | 'proxy';
  basicAuth: any;
  cache: QueryCache<PromQuery>;
  cacheLevel: PrometheusCacheLevel;
  customQueryParameters: URLSearchParams;
  datasourceConfigurationPrometheusFlavor?: PromApplication;
  datasourceConfigurationPrometheusVersion?: string;
  disableRecordingRules: boolean;
  exemplarTraceIdDestinations: ExemplarTraceIdDestination[] | undefined;
  exemplarsAvailable: boolean;
  hasIncrementalQuery: boolean;
  httpMethod: string;
  id: number;
  interval: string;
  languageProvider: PrometheusLanguageProviderInterface;
  lookupsDisabled: boolean;
  metricNamesAutocompleteSuggestionLimit: number;
  ruleMappings: RuleQueryMapping;
  seriesEndpoint: boolean;
  seriesLimit: number;
  type: string;
  url: string;
  withCredentials: boolean;
  defaultEditor?: QueryEditorMode;

  constructor(
    instanceSettings: DataSourceInstanceSettings<PromOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv(),
    languageProvider?: PrometheusLanguageProviderInterface
  ) {
    super(instanceSettings);

    // DATASOURCE CONFIGURATION PROPERTIES
    this.access = instanceSettings.access;
    this.basicAuth = instanceSettings.basicAuth;
    this.cache = new QueryCache({
      getTargetSignature: this.getPrometheusTargetSignature.bind(this),
      overlapString: instanceSettings.jsonData.incrementalQueryOverlapWindow ?? defaultPrometheusQueryOverlapWindow,
      applyInterpolation: this.interpolateString.bind(this),
    });
    this.cacheLevel = instanceSettings.jsonData.cacheLevel ?? PrometheusCacheLevel.Low;
    this.customQueryParameters = new URLSearchParams(instanceSettings.jsonData.customQueryParameters);
    this.datasourceConfigurationPrometheusFlavor = instanceSettings.jsonData.prometheusType;
    this.datasourceConfigurationPrometheusVersion = instanceSettings.jsonData.prometheusVersion;
    this.disableRecordingRules = instanceSettings.jsonData.disableRecordingRules ?? false;
    this.exemplarTraceIdDestinations = instanceSettings.jsonData.exemplarTraceIdDestinations;
    this.exemplarsAvailable = true;
    this.hasIncrementalQuery = instanceSettings.jsonData.incrementalQuerying ?? false;
    this.httpMethod = instanceSettings.jsonData.httpMethod || 'GET';
    this.id = instanceSettings.id;
    this.interval = instanceSettings.jsonData.timeInterval || '15s';
    this.lookupsDisabled = instanceSettings.jsonData.disableMetricsLookup ?? false;
    this.metricNamesAutocompleteSuggestionLimit =
      instanceSettings.jsonData.codeModeMetricNamesSuggestionLimit ?? SUGGESTIONS_LIMIT;
    this.ruleMappings = {};
    this.seriesEndpoint = instanceSettings.jsonData.seriesEndpoint ?? false;
    this.seriesLimit = instanceSettings.jsonData.seriesLimit ?? DEFAULT_SERIES_LIMIT;
    this.type = 'prometheus';
    this.url = instanceSettings.url!;
    this.withCredentials = Boolean(instanceSettings.withCredentials);
    this.defaultEditor = instanceSettings.jsonData.defaultEditor;

    // INHERITED PROPERTIES
    this.annotations = PrometheusAnnotationSupport(this);
    this.variables = new PrometheusVariableSupport(this, this.templateSrv);

    // LANGUAGE PROVIDER
    // This needs to be the last thing we initialize.
    this.languageProvider = languageProvider ?? new PrometheusLanguageProvider(this);
  }

  /**
   * Initializes the Prometheus datasource by loading recording rules and checking exemplar availability.
   *
   * This method performs two key initialization tasks: Loads recording rules from the
   * Prometheus API and checks if exemplars are available by testing the exemplars API endpoint.
   */
  init = async (): Promise<void> => {
    if (!this.disableRecordingRules) {
      this.loadRules();
    }
    this.exemplarsAvailable = await this.areExemplarsAvailable();
  };

  /**
   * Loads recording rules from the Prometheus API and extracts rule mappings.
   *
   * This method fetches rules from the `/api/v1/rules` endpoint and processes
   * them to create a mapping of rule names to their corresponding queries and labels.
   * The rules API is experimental, so errors are logged but not thrown.
   */
  private async loadRules(): Promise<void> {
    try {
      const params = {};
      const options = { showErrorAlert: false };
      const res = await this.metadataRequest('/api/v1/rules', params, options);
      const ruleGroups = res.data?.data?.groups;

      if (ruleGroups) {
        this.ruleMappings = extractRuleMappingFromGroups(ruleGroups);
      }
    } catch (err) {
      console.log('Rules API is experimental. Ignore next error.');
      console.error(err);
    }
  }

  /**
   * Checks if exemplars are available by testing the exemplars API endpoint.
   *
   * This method makes a test request to the `/api/v1/query_exemplars` endpoint to determine
   * if the Prometheus instance supports exemplars. The test uses a simple query with a
   * 30-minute time range. If the request succeeds with a 'success' status, exemplars
   * are considered available. Errors are caught and return false to avoid breaking
   * the datasource initialization.
   */
  private async areExemplarsAvailable(): Promise<boolean> {
    try {
      const params = {
        query: 'test',
        start: dateTime().subtract(30, 'minutes').valueOf().toString(),
        end: dateTime().valueOf().toString(),
      };
      const options = { showErrorAlert: false };
      const res = await this.metadataRequest('/api/v1/query_exemplars', params, options);

      return res.data.status === 'success';
    } catch (err) {
      return false;
    }
  }

  getQueryDisplayText(query: PromQuery) {
    return query.expr;
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
    // users may choose the series endpoint as it has a POST method
    // while the label values is only GET
    if (this.seriesEndpoint) {
      return false;
    }

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
    // User hasn't configured flavor/version yet, default behavior is to support labels match api support
    if (!this.datasourceConfigurationPrometheusVersion || !this.datasourceConfigurationPrometheusFlavor) {
      return true;
    }

    if (targetFlavor !== this.datasourceConfigurationPrometheusFlavor) {
      return false;
    }

    return gte(this.datasourceConfigurationPrometheusVersion, targetVersion);
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
      if (!options.headers!['Content-Type']) {
        options.headers!['Content-Type'] = 'application/x-www-form-urlencoded';
      }
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
    return abstractQueries.map((abstractQuery) => importFromAbstractQuery(abstractQuery));
  }

  async exportToAbstractQueries(queries: PromQuery[]): Promise<AbstractQuery[]> {
    return queries.map((query) => exportToAbstractQuery(query));
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

  interpolateQueryExpr(value: string | string[] = [], variable: QueryVariableModel | CustomVariableModel) {
    return interpolateQueryExpr(value, variable);
  }

  targetContainsTemplate(target: PromQuery) {
    return this.templateSrv.containsTemplate(target.expr);
  }

  shouldRunExemplarQuery(target: PromQuery, request: DataQueryRequest<PromQuery>): boolean {
    if (target.exemplar) {
      // We check all already processed targets and only create exemplar target for not used metric names
      const metricName = this.languageProvider.retrieveHistogramMetrics().find((m) => target.expr.includes(m));
      // Remove targets that weren't processed yet (in targets array they are after current target)
      const currentTargetIdx = request.targets.findIndex((t) => t.refId === target.refId);
      const targets = request.targets.slice(0, currentTargetIdx).filter((t) => !t.hide);

      if (!metricName || (metricName && !targets.some((t) => t.expr.includes(metricName)))) {
        return true;
      }
      return false;
    }
    return false;
  }

  processTargetV2(target: PromQuery, request: DataQueryRequest<PromQuery>) {
    // The `utcOffsetSec` parameter is required by the backend to correctly align time ranges.
    // This alignment ensures that relative time ranges (e.g., "Last N hours/days/years") are adjusted
    // according to the user's selected time zone, rather than defaulting to UTC.
    //
    // Example: If the user selects "Last 5 days," each day should begin at 00:00 in the chosen time zone,
    // rather than at 00:00 UTC, ensuring an accurate breakdown.
    //
    // This adjustment does not apply to absolute time ranges, where users explicitly set
    // the start and end timestamps.
    //
    // Handling `utcOffsetSec`:
    // - When using the browser's time zone, the UTC offset is derived from the request range object.
    // - When the user selects a custom time zone, the UTC offset must be calculated accordingly.
    // More details:
    // - Issue that led to the introduction of utcOffsetSec: https://github.com/grafana/grafana/issues/17278
    // - Implementation PR: https://github.com/grafana/grafana/pull/17477
    let utcOffset = request.range.to.utcOffset();
    if (request.timezone === 'browser') {
      // we need to check if the request is a relative or absolute range.
      // if it is absolute time range then utcOffset must be 0. we don't care the offset
      // because we are already sending the from and to values in utc. we don't need to adjust them again
      // for relative ranges we need utcOffset to adjust query range.
      utcOffset = this.isUsingRelativeTimeRange(request.range) ? utcOffset : 0;
    } else {
      utcOffset = tz(request.timezone).utcOffset();
    }

    const processedTargets: PromQuery[] = [];
    const processedTarget = {
      ...target,
      exemplar: this.shouldRunExemplarQuery(target, request),
      requestId: request.panelId + target.refId,
      utcOffsetSec: utcOffset * 60,
    };

    if (config.featureToggles.promQLScope) {
      processedTarget.scopes = (request.scopes ?? []).map((scope) => ({
        name: scope.metadata.name,
        ...scope.spec,
      }));
    }

    if (config.featureToggles.groupByVariable) {
      processedTarget.groupByKeys = request.groupByKeys;
    }

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
          exemplar: false,
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

    // Use incremental query only if enabled and no instant queries or no $__range variables
    const shouldUseIncrementalQuery =
      this.hasIncrementalQuery && !request.targets.some((target) => target.instant || target.expr.includes('$__range'));

    let fullOrPartialRequest: DataQueryRequest<PromQuery> = request;
    let requestInfo: CacheRequestInfo<PromQuery> | undefined = undefined;

    if (shouldUseIncrementalQuery) {
      requestInfo = this.cache.requestInfo(request);
      fullOrPartialRequest = requestInfo.requests[0];
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

  metricFindQuery(query: string, options?: LegacyMetricFindQueryOptions) {
    if (!query) {
      return Promise.resolve([]);
    }

    const timeRange = options?.range ?? getDefaultTimeRange();

    const scopedVars = {
      ...this.getIntervalVars(),
      ...this.getRangeScopedVars(timeRange),
    };
    const interpolated = this.templateSrv.replace(query, scopedVars, this.interpolateQueryExpr);
    const metricFindQuery = new PrometheusMetricFindQuery(this, interpolated);
    return metricFindQuery.process(timeRange);
  }

  getIntervalVars() {
    return {
      __interval: { text: this.interval, value: this.interval },
      __interval_ms: { text: rangeUtil.intervalToMs(this.interval), value: rangeUtil.intervalToMs(this.interval) },
    };
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

  // By implementing getTagKeys and getTagValues we add ad-hoc filters functionality
  // this is used to get label keys, a.k.a label names
  // it is used in metric_find_query.ts
  // and in Tempo here grafana/public/app/plugins/datasource/tempo/QueryEditor/ServiceGraphSection.tsx
  async getTagKeys(options: DataSourceGetTagKeysOptions<PromQuery>): Promise<MetricFindValue[]> {
    if (!options.timeRange) {
      options.timeRange = getDefaultTimeRange();
    }

    if (config.featureToggles.promQLScope && (options?.scopes?.length ?? 0) > 0) {
      const suggestions = await this.languageProvider.fetchSuggestions(
        options.timeRange,
        options.queries,
        options.scopes,
        options.filters
      );

      // filter out already used labels and empty labels
      return suggestions
        .filter((labelName) => !!labelName && !options.filters.find((filter) => filter.key === labelName))
        .map((k) => ({ value: k, text: k }));
    }

    const match = extractResourceMatcher(options.queries ?? [], options.filters);

    let labelKeys: string[] = await this.languageProvider.queryLabelKeys(options.timeRange, match);

    // filter out already used labels
    return labelKeys
      .filter((labelName) => !options.filters.find((filter) => filter.key === labelName))
      .map((k) => ({ value: k, text: k }));
  }

  // By implementing getTagKeys and getTagValues we add ad-hoc filters functionality
  async getTagValues(options: DataSourceGetTagValuesOptions<PromQuery>): Promise<MetricFindValue[]> {
    if (!options.timeRange) {
      options.timeRange = getDefaultTimeRange();
    }

    const requestId = `[${this.uid}][${options.key}]`;
    if (config.featureToggles.promQLScope && (options?.scopes?.length ?? 0) > 0) {
      return (
        await this.languageProvider.fetchSuggestions(
          options.timeRange,
          options.queries,
          options.scopes,
          options.filters,
          options.key,
          undefined,
          requestId
        )
      ).map((v) => ({ value: v, text: v }));
    }

    const match = extractResourceMatcher(options.queries ?? [], options.filters);

    return (await this.languageProvider.queryLabelValues(options.timeRange, options.key, match)).map((v) => ({
      value: v,
      text: v,
    }));
  }

  interpolateVariablesInQueries(
    queries: PromQuery[],
    scopedVars: ScopedVars,
    filters?: AdHocVariableFilter[]
  ): PromQuery[] {
    let expandedQueries = queries;
    if (queries && queries.length) {
      expandedQueries = queries.map((query) => {
        const interpolatedQuery = this.templateSrv.replace(
          query.expr,
          scopedVars,
          this.interpolateExploreMetrics(query.fromExploreMetrics)
        );
        const replacedInterpolatedQuery = config.featureToggles.promQLScope
          ? interpolatedQuery
          : this.templateSrv.replace(
              this.enhanceExprWithAdHocFilters(filters, interpolatedQuery),
              scopedVars,
              this.interpolateQueryExpr
            );

        const expandedQuery = {
          ...query,
          ...(config.featureToggles.promQLScope ? { adhocFilters: this.generateScopeFilters(filters) } : {}),
          datasource: this.getRef(),
          expr: replacedInterpolatedQuery,
          interval: this.templateSrv.replace(query.interval, scopedVars),
        };

        return expandedQuery;
      });
    }
    return expandedQueries;
  }

  getQueryHints(query: PromQuery, result: unknown[]) {
    return getQueryHints(query.expr ?? '', result, this);
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
      case 'ADD_HISTOGRAM_AVG': {
        expression = `histogram_avg(rate(${expression}[$__rate_interval]))`;
        break;
      }
      case 'ADD_HISTOGRAM_FRACTION': {
        expression = `histogram_fraction(0,0.2,rate(${expression}[$__rate_interval]))`;
        break;
      }
      case 'ADD_HISTOGRAM_COUNT': {
        expression = `histogram_count(rate(${expression}[$__rate_interval]))`;
        break;
      }
      case 'ADD_HISTOGRAM_SUM': {
        expression = `histogram_sum(rate(${expression}[$__rate_interval]))`;
        break;
      }
      case 'ADD_HISTOGRAM_STDDEV': {
        expression = `histogram_stddev(rate(${expression}[$__rate_interval]))`;
        break;
      }
      case 'ADD_HISTOGRAM_STDVAR': {
        expression = `histogram_stdvar(rate(${expression}[$__rate_interval]))`;
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
          expression = expandRecordingRules(expression, action.options as any);
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

  /**
   * This converts the adhocVariableFilter array and converts it to scopeFilter array
   * @param filters
   */
  generateScopeFilters(filters?: AdHocVariableFilter[]): ScopeSpecFilter[] {
    if (!filters) {
      return [];
    }

    return filters.map((f) => ({
      key: f.key,
      operator: scopeFilterOperatorMap[f.operator],
      value: this.templateSrv.replace(f.value, {}, this.interpolateQueryExpr),
      values: f.values?.map((v) => this.templateSrv.replace(v, {}, this.interpolateQueryExpr)),
    }));
  }

  enhanceExprWithAdHocFilters(filters: AdHocVariableFilter[] | undefined, expr: string) {
    if (!filters || filters.length === 0) {
      return expr;
    }

    const finalQuery = filters.reduce((acc, filter) => {
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

    // We need a first replace to evaluate variables before applying adhoc filters
    // This is required for an expression like `metric > $VAR` where $VAR is a float to which we must not add adhoc filters
    const expr = this.templateSrv.replace(
      target.expr,
      variables,
      this.interpolateExploreMetrics(target.fromExploreMetrics)
    );

    // Apply ad-hoc filters
    // When ad-hoc filters are applied, we replace again the variables in case the ad-hoc filters also reference a variable
    const exprWithAdhoc = config.featureToggles.promQLScope
      ? expr
      : this.templateSrv.replace(this.enhanceExprWithAdHocFilters(filters, expr), variables, this.interpolateQueryExpr);

    return {
      ...target,
      ...(config.featureToggles.promQLScope ? { adhocFilters: this.generateScopeFilters(filters) } : {}),
      expr: exprWithAdhoc,
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

  interpolateExploreMetrics(fromExploreMetrics?: boolean) {
    return (value: string | string[] = [], variable: QueryVariableModel | CustomVariableModel) => {
      if (typeof value === 'string' && fromExploreMetrics) {
        if (variable.name === 'filters') {
          return wrapUtf8Filters(value);
        }
        if (variable.name === 'groupby') {
          return utf8Support(value);
        }
      }
      return this.interpolateQueryExpr(value, variable);
    };
  }

  isUsingRelativeTimeRange(range: TimeRange): boolean {
    if (typeof range.raw.from !== 'string' || typeof range.raw.to !== 'string') {
      return false;
    }

    return range.raw.from.includes('now') || range.raw.to.includes('now');
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

export function extractRuleMappingFromGroups(groups: RawRecordingRules[]): RuleQueryMapping {
  return groups.reduce<RuleQueryMapping>(
    (mapping, group) =>
      group.rules
        .filter((rule) => rule.type === 'recording')
        .reduce((acc, rule) => {
          // retrieve existing record
          const existingRule = acc[rule.name] ?? [];
          // push a new query with labels
          existingRule.push({
            query: rule.query,
            labels: rule.labels,
          });
          acc[rule.name] = existingRule;
          return acc;
        }, mapping),
    {}
  );
}

/**
 * It creates a matcher string for resource calls
 * @param queries
 * @param adhocFilters
 *
 * @example
 * queries<PromQuery>=[{expr:`metricName{label="value"}`}]
 * adhocFilters={key:"instance", operator:"=", value:"localhost"}
 * returns {__name__=~"metricName", instance="localhost"}
 */
export const extractResourceMatcher = (
  queries: PromQuery[],
  adhocFilters: AdHocVariableFilter[]
): string | undefined => {
  // Extract metric names from queries we have already
  const metricMatch = populateMatchParamsFromQueries(queries);
  const labelFilters: QueryBuilderLabelFilter[] = adhocFilters.map((f) => ({
    label: f.key,
    value: f.value,
    op: f.operator,
  }));
  // Extract label filters from the filters we have already
  const labelsMatch = renderLabelsWithoutBrackets(labelFilters);

  if (metricMatch.length === 0 && labelsMatch.length === 0) {
    return undefined;
  }

  // Create a matcher using metric names and label filters
  return `{${[...metricMatch, ...labelsMatch].join(',')}}`;
};
