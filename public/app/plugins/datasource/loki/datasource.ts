import { cloneDeep, map as lodashMap } from 'lodash';
import { lastValueFrom, merge, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';

import {
  AbstractQuery,
  AnnotationEvent,
  AnnotationQueryRequest,
  CoreApp,
  DataFrame,
  DataFrameView,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceInstanceSettings,
  DataSourceWithLogsContextSupport,
  DataSourceWithSupplementaryQueriesSupport,
  SupplementaryQueryType,
  DataSourceWithQueryExportSupport,
  DataSourceWithQueryImportSupport,
  dateMath,
  DateTime,
  FieldCache,
  FieldType,
  Labels,
  LoadingState,
  LogLevel,
  LogRowModel,
  QueryFixAction,
  QueryHint,
  rangeUtil,
  ScopedVars,
  TimeRange,
  LogRowContextOptions,
} from '@grafana/data';
import { BackendSrvRequest, config, DataSourceWithBackend, FetchError } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { queryLogsSample, queryLogsVolume } from 'app/core/logsModel';
import { convertToWebSocketUrl } from 'app/core/utils/explore';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';

import { serializeParams } from '../../../core/utils/fetch';
import { getLogLevelFromKey } from '../../../features/logs/utils';
import { renderLegendFormat } from '../prometheus/legend';
import { replaceVariables, returnVariables } from '../prometheus/querybuilder/shared/parsingUtils';

import LanguageProvider from './LanguageProvider';
import { LiveStreams, LokiLiveTarget } from './LiveStreams';
import { LogContextProvider } from './LogContextProvider';
import { transformBackendResult } from './backendResultTransformer';
import { LokiAnnotationsQueryEditor } from './components/AnnotationsQueryEditor';
import { escapeLabelValueInSelector, isRegexSelector } from './languageUtils';
import { labelNamesRegex, labelValuesRegex } from './migrations/variableQueryMigrations';
import {
  addLabelFormatToQuery,
  addLabelToQuery,
  addNoPipelineErrorToQuery,
  addParserToQuery,
  removeCommentsFromQuery,
  addFilterAsLabelFilter,
  getParserPositions,
  toLabelFilter,
  addLineFilter,
  findLastPosition,
  getLabelFilterPositions,
} from './modifyQuery';
import { getQueryHints } from './queryHints';
import { runSplitQuery } from './querySplitting';
import {
  getLogQueryFromMetricsQuery,
  getNormalizedLokiQuery,
  getStreamSelectorsFromQuery,
  isLogsQuery,
  isValidQuery,
  requestSupportsSplitting,
} from './queryUtils';
import { doLokiChannelStream } from './streaming';
import { trackQuery } from './tracking';
import {
  LokiOptions,
  LokiQuery,
  LokiQueryType,
  LokiVariableQuery,
  LokiVariableQueryType,
  QueryStats,
  SupportingQueryType,
} from './types';
import { LokiVariableSupport } from './variables';

export type RangeQueryOptions = DataQueryRequest<LokiQuery> | AnnotationQueryRequest<LokiQuery>;
export const DEFAULT_MAX_LINES = 1000;
export const LOKI_ENDPOINT = '/loki/api/v1';
export const REF_ID_DATA_SAMPLES = 'loki-data-samples';
export const REF_ID_STARTER_ANNOTATION = 'annotation-';
export const REF_ID_STARTER_LOG_ROW_CONTEXT = 'log-row-context-query-';
export const REF_ID_STARTER_LOG_VOLUME = 'log-volume-';
export const REF_ID_STARTER_LOG_SAMPLE = 'log-sample-';
const NS_IN_MS = 1000000;

export function makeRequest(
  query: LokiQuery,
  range: TimeRange,
  app: CoreApp,
  requestId: string,
  hideFromInspector?: boolean
): DataQueryRequest<LokiQuery> {
  const intervalInfo = rangeUtil.calculateInterval(range, 1);
  return {
    targets: [query],
    requestId,
    interval: intervalInfo.interval,
    intervalMs: intervalInfo.intervalMs,
    range: range,
    scopedVars: {},
    timezone: 'UTC',
    app,
    startTime: Date.now(),
    hideFromInspector,
  };
}

export class LokiDatasource
  extends DataSourceWithBackend<LokiQuery, LokiOptions>
  implements
    DataSourceWithLogsContextSupport,
    DataSourceWithSupplementaryQueriesSupport<LokiQuery>,
    DataSourceWithQueryImportSupport<LokiQuery>,
    DataSourceWithQueryExportSupport<LokiQuery>
{
  private streams = new LiveStreams();
  languageProvider: LanguageProvider;
  logContextProvider: LogContextProvider;
  maxLines: number;

  constructor(
    private instanceSettings: DataSourceInstanceSettings<LokiOptions>,
    private readonly templateSrv: TemplateSrv = getTemplateSrv(),
    private readonly timeSrv: TimeSrv = getTimeSrv()
  ) {
    super(instanceSettings);

    this.languageProvider = new LanguageProvider(this);
    const settingsData = instanceSettings.jsonData || {};
    this.maxLines = parseInt(settingsData.maxLines ?? '0', 10) || DEFAULT_MAX_LINES;
    this.annotations = {
      QueryEditor: LokiAnnotationsQueryEditor,
    };
    this.variables = new LokiVariableSupport(this);
    this.logContextProvider = new LogContextProvider(this);
  }

  getDataProvider(
    type: SupplementaryQueryType,
    request: DataQueryRequest<LokiQuery>
  ): Observable<DataQueryResponse> | undefined {
    if (!this.getSupportedSupplementaryQueryTypes().includes(type)) {
      return undefined;
    }
    switch (type) {
      case SupplementaryQueryType.LogsVolume:
        return this.getLogsVolumeDataProvider(request);
      case SupplementaryQueryType.LogsSample:
        return this.getLogsSampleDataProvider(request);
      default:
        return undefined;
    }
  }

  getSupportedSupplementaryQueryTypes(): SupplementaryQueryType[] {
    return [SupplementaryQueryType.LogsVolume, SupplementaryQueryType.LogsSample];
  }

  getSupplementaryQuery(type: SupplementaryQueryType, query: LokiQuery): LokiQuery | undefined {
    if (!this.getSupportedSupplementaryQueryTypes().includes(type)) {
      return undefined;
    }

    const normalizedQuery = getNormalizedLokiQuery(query);
    const expr = removeCommentsFromQuery(normalizedQuery.expr);
    let isQuerySuitable = false;

    switch (type) {
      case SupplementaryQueryType.LogsVolume:
        // it has to be a logs-producing range-query
        isQuerySuitable = !!(query.expr && isLogsQuery(query.expr) && query.queryType === LokiQueryType.Range);
        if (!isQuerySuitable) {
          return undefined;
        }

        return {
          ...normalizedQuery,
          refId: `${REF_ID_STARTER_LOG_VOLUME}${normalizedQuery.refId}`,
          instant: false,
          supportingQueryType: SupportingQueryType.LogsVolume,
          expr: `sum by (level) (count_over_time(${expr}[$__interval]))`,
        };

      case SupplementaryQueryType.LogsSample:
        // it has to be a metric query
        isQuerySuitable = !!(query.expr && !isLogsQuery(query.expr));
        if (!isQuerySuitable) {
          return undefined;
        }
        return {
          ...normalizedQuery,
          refId: `${REF_ID_STARTER_LOG_SAMPLE}${normalizedQuery.refId}`,
          expr: getLogQueryFromMetricsQuery(expr),
          maxLines: 100,
        };

      default:
        return undefined;
    }
  }

  getLogsVolumeDataProvider(request: DataQueryRequest<LokiQuery>): Observable<DataQueryResponse> | undefined {
    const logsVolumeRequest = cloneDeep(request);
    const targets = logsVolumeRequest.targets
      .map((query) => this.getSupplementaryQuery(SupplementaryQueryType.LogsVolume, query))
      .filter((query): query is LokiQuery => !!query);

    if (!targets.length) {
      return undefined;
    }

    return queryLogsVolume(
      this,
      { ...logsVolumeRequest, targets },
      {
        extractLevel,
        range: request.range,
        targets: request.targets,
      }
    );
  }

  getLogsSampleDataProvider(request: DataQueryRequest<LokiQuery>): Observable<DataQueryResponse> | undefined {
    const logsSampleRequest = cloneDeep(request);
    const targets = logsSampleRequest.targets
      .map((query) => this.getSupplementaryQuery(SupplementaryQueryType.LogsSample, query))
      .filter((query): query is LokiQuery => !!query);

    if (!targets.length) {
      return undefined;
    }
    return queryLogsSample(this, { ...logsSampleRequest, targets });
  }

  query(request: DataQueryRequest<LokiQuery>): Observable<DataQueryResponse> {
    const queries = request.targets
      .map(getNormalizedLokiQuery) // "fix" the `.queryType` prop
      .map((q) => ({ ...q, maxLines: q.maxLines ?? this.maxLines }));

    const fixedRequest: DataQueryRequest<LokiQuery> = {
      ...request,
      targets: queries,
    };

    const streamQueries = fixedRequest.targets.filter((q) => q.queryType === LokiQueryType.Stream);
    if (config.featureToggles.lokiLive && streamQueries.length > 0 && fixedRequest.rangeRaw?.to === 'now') {
      // this is still an in-development feature,
      // we do not support mixing stream-queries with normal-queries for now.
      const streamRequest = {
        ...fixedRequest,
        targets: streamQueries,
      };
      return merge(
        ...streamQueries.map((q) =>
          doLokiChannelStream(
            this.applyTemplateVariables(q, request.scopedVars),
            this, // the datasource
            streamRequest
          )
        )
      );
    }

    if (fixedRequest.liveStreaming) {
      return this.runLiveQueryThroughBackend(fixedRequest);
    }

    if (config.featureToggles.lokiQuerySplitting && requestSupportsSplitting(fixedRequest.targets)) {
      return runSplitQuery(this, fixedRequest);
    }

    return this.runQuery(fixedRequest);
  }

  runQuery(fixedRequest: DataQueryRequest<LokiQuery> & { targets: LokiQuery[] }) {
    const startTime = new Date();
    return super.query(fixedRequest).pipe(
      map((response) =>
        transformBackendResult(response, fixedRequest.targets, this.instanceSettings.jsonData.derivedFields ?? [])
      ),
      tap((response) => trackQuery(response, fixedRequest, startTime))
    );
  }

  runLiveQueryThroughBackend(request: DataQueryRequest<LokiQuery>): Observable<DataQueryResponse> {
    // this only works in explore-mode, so variables don't need to be handled,
    //  and only for logs-queries, not metric queries
    const logsQueries = request.targets.filter((query) => query.expr !== '' && isLogsQuery(query.expr));

    if (logsQueries.length === 0) {
      return of({
        data: [],
        state: LoadingState.Done,
      });
    }

    const subQueries = logsQueries.map((query) => {
      const maxDataPoints = query.maxLines || this.maxLines;
      // FIXME: currently we are running it through the frontend still.
      return this.runLiveQuery(query, maxDataPoints);
    });

    return merge(...subQueries);
  }

  createLiveTarget(target: LokiQuery, maxDataPoints: number): LokiLiveTarget {
    const query = target.expr;
    const baseUrl = this.instanceSettings.url;
    const params = serializeParams({ query });

    return {
      query,
      url: convertToWebSocketUrl(`${baseUrl}/loki/api/v1/tail?${params}`),
      refId: target.refId,
      size: maxDataPoints,
    };
  }

  /**
   * Runs live queries which in this case means creating a websocket and listening on it for new logs.
   * This returns a bit different dataFrame than runQueries as it returns single dataframe even if there are multiple
   * Loki streams, sets only common labels on dataframe.labels and has additional dataframe.fields.labels for unique
   * labels per row.
   */
  runLiveQuery = (target: LokiQuery, maxDataPoints: number): Observable<DataQueryResponse> => {
    const liveTarget = this.createLiveTarget(target, maxDataPoints);

    return this.streams.getStream(liveTarget).pipe(
      map((data) => ({
        data: data || [],
        key: `loki-${liveTarget.refId}`,
        state: LoadingState.Streaming,
      })),
      catchError((err: any) => {
        return throwError(() => `Live tailing was stopped due to following error: ${err.reason}`);
      })
    );
  };

  getRangeScopedVars(range: TimeRange = this.getTimeRange()) {
    const msRange = range.to.diff(range.from);
    const sRange = Math.round(msRange / 1000);
    return {
      __range_ms: { text: msRange, value: msRange },
      __range_s: { text: sRange, value: sRange },
      __range: { text: sRange + 's', value: sRange + 's' },
    };
  }

  interpolateVariablesInQueries(queries: LokiQuery[], scopedVars: ScopedVars): LokiQuery[] {
    let expandedQueries = queries;
    if (queries && queries.length) {
      expandedQueries = queries.map((query) => ({
        ...query,
        datasource: this.getRef(),
        expr: this.addAdHocFilters(this.templateSrv.replace(query.expr, scopedVars, this.interpolateQueryExpr)),
      }));
    }

    return expandedQueries;
  }

  getQueryDisplayText(query: LokiQuery) {
    return query.expr;
  }

  getTimeRange() {
    return this.timeSrv.timeRange();
  }

  getTimeRangeParams() {
    const timeRange = this.getTimeRange();
    return { start: timeRange.from.valueOf() * NS_IN_MS, end: timeRange.to.valueOf() * NS_IN_MS };
  }

  async importFromAbstractQueries(abstractQueries: AbstractQuery[]): Promise<LokiQuery[]> {
    await this.languageProvider.start();
    const existingKeys = this.languageProvider.labelKeys;

    if (existingKeys && existingKeys.length) {
      abstractQueries = abstractQueries.map((abstractQuery) => {
        abstractQuery.labelMatchers = abstractQuery.labelMatchers.filter((labelMatcher) => {
          return existingKeys.includes(labelMatcher.name);
        });
        return abstractQuery;
      });
    }

    return abstractQueries.map((abstractQuery) => this.languageProvider.importFromAbstractQuery(abstractQuery));
  }

  async exportToAbstractQueries(queries: LokiQuery[]): Promise<AbstractQuery[]> {
    return queries.map((query) => this.languageProvider.exportToAbstractQuery(query));
  }

  async metadataRequest(url: string, params?: Record<string, string | number>, options?: Partial<BackendSrvRequest>) {
    // url must not start with a `/`, otherwise the AJAX-request
    // going from the browser will contain `//`, which can cause problems.
    if (url.startsWith('/')) {
      throw new Error(`invalid metadata request url: ${url}`);
    }

    const res = await this.getResource(url, params, options);
    return res.data ?? (res || []);
  }

  async getQueryStats(query: string): Promise<QueryStats> {
    const { start, end } = this.getTimeRangeParams();
    const labelMatchers = getStreamSelectorsFromQuery(query);

    let statsForAll: QueryStats = { streams: 0, chunks: 0, bytes: 0, entries: 0 };

    for (const labelMatcher of labelMatchers) {
      try {
        const data = await this.metadataRequest(
          'index/stats',
          { query: labelMatcher, start, end },
          { showErrorAlert: false }
        );

        statsForAll = {
          streams: statsForAll.streams + data.streams,
          chunks: statsForAll.chunks + data.chunks,
          bytes: statsForAll.bytes + data.bytes,
          entries: statsForAll.entries + data.entries,
        };
      } catch (e) {
        break;
      }
    }

    return statsForAll;
  }

  async metricFindQuery(query: LokiVariableQuery | string) {
    if (!query) {
      return Promise.resolve([]);
    }

    if (typeof query === 'string') {
      const interpolated = this.interpolateString(query);
      return await this.legacyProcessMetricFindQuery(interpolated);
    }

    const interpolatedQuery = {
      ...query,
      label: this.interpolateString(query.label || ''),
      stream: this.interpolateString(query.stream || ''),
    };

    return await this.processMetricFindQuery(interpolatedQuery);
  }

  async processMetricFindQuery(query: LokiVariableQuery) {
    if (query.type === LokiVariableQueryType.LabelNames) {
      return this.labelNamesQuery();
    }

    if (!query.label) {
      return [];
    }

    // If we have stream selector, use /series endpoint
    if (query.stream) {
      return this.labelValuesSeriesQuery(query.stream, query.label);
    }

    return this.labelValuesQuery(query.label);
  }

  async legacyProcessMetricFindQuery(query: string) {
    const labelNames = query.match(labelNamesRegex);
    if (labelNames) {
      return await this.labelNamesQuery();
    }

    const labelValues = query.match(labelValuesRegex);
    if (labelValues) {
      // If we have stream selector, use /series endpoint
      if (labelValues[1]) {
        return await this.labelValuesSeriesQuery(labelValues[1], labelValues[2]);
      }
      return await this.labelValuesQuery(labelValues[2]);
    }

    return Promise.resolve([]);
  }

  async labelNamesQuery() {
    const url = 'labels';
    const params = this.getTimeRangeParams();
    const result = await this.metadataRequest(url, params);
    return result.map((value: string) => ({ text: value }));
  }

  async labelValuesQuery(label: string) {
    const params = this.getTimeRangeParams();
    const url = `label/${label}/values`;
    const result = await this.metadataRequest(url, params);
    return result.map((value: string) => ({ text: value }));
  }

  async labelValuesSeriesQuery(expr: string, label: string) {
    const timeParams = this.getTimeRangeParams();
    const params = {
      ...timeParams,
      'match[]': expr,
    };
    const url = 'series';
    const streams = new Set();
    const result = await this.metadataRequest(url, params);
    result.forEach((stream: { [key: string]: string }) => {
      if (stream[label]) {
        streams.add({ text: stream[label] });
      }
    });

    return Array.from(streams);
  }

  async getDataSamples(query: LokiQuery): Promise<DataFrame[]> {
    // Currently works only for logs sample
    if (!isValidQuery(query.expr) || !isLogsQuery(query.expr)) {
      return [];
    }

    const lokiLogsQuery: LokiQuery = {
      expr: query.expr,
      queryType: LokiQueryType.Range,
      refId: REF_ID_DATA_SAMPLES,
      // For samples we limit the request to 10 lines, so queries are small and fast
      maxLines: 10,
    };

    const timeRange = this.getTimeRange();
    const request = makeRequest(lokiLogsQuery, timeRange, CoreApp.Unknown, REF_ID_DATA_SAMPLES, true);
    return await lastValueFrom(this.query(request).pipe(switchMap((res) => of(res.data))));
  }

  // By implementing getTagKeys and getTagValues we add ad-hoc filters functionality
  async getTagKeys() {
    return await this.labelNamesQuery();
  }

  async getTagValues(options: any = {}) {
    return await this.labelValuesQuery(options.key);
  }

  interpolateQueryExpr(value: any, variable: any) {
    // if no multi or include all do not regexEscape
    if (!variable.multi && !variable.includeAll) {
      return lokiRegularEscape(value);
    }

    if (typeof value === 'string') {
      return lokiSpecialRegexEscape(value);
    }

    const escapedValues = lodashMap(value, lokiSpecialRegexEscape);
    return escapedValues.join('|');
  }

  modifyQuery(query: LokiQuery, action: QueryFixAction): LokiQuery {
    let expression = query.expr ?? '';
    switch (action.type) {
      case 'ADD_FILTER': {
        if (action.options?.key && action.options?.value) {
          const value = escapeLabelValueInSelector(action.options.value);
          expression = addLabelToQuery(expression, action.options.key, '=', value);
        }
        break;
      }
      case 'ADD_FILTER_OUT': {
        if (action.options?.key && action.options?.value) {
          const value = escapeLabelValueInSelector(action.options.value);
          expression = addLabelToQuery(expression, action.options.key, '!=', value);
        }
        break;
      }
      case 'ADD_LOGFMT_PARSER': {
        expression = addParserToQuery(expression, 'logfmt');
        break;
      }
      case 'ADD_JSON_PARSER': {
        expression = addParserToQuery(expression, 'json');
        break;
      }
      case 'ADD_UNPACK_PARSER': {
        expression = addParserToQuery(expression, 'unpack');
        break;
      }
      case 'ADD_NO_PIPELINE_ERROR': {
        expression = addNoPipelineErrorToQuery(expression);
        break;
      }
      case 'ADD_LEVEL_LABEL_FORMAT': {
        if (action.options?.originalLabel && action.options?.renameTo) {
          expression = addLabelFormatToQuery(expression, {
            renameTo: action.options.renameTo,
            originalLabel: action.options.originalLabel,
          });
        }
        break;
      }
      case 'ADD_LABEL_FILTER': {
        const parserPositions = getParserPositions(query.expr);
        const labelFilterPositions = getLabelFilterPositions(query.expr);
        const lastPosition = findLastPosition([...parserPositions, ...labelFilterPositions]);
        const filter = toLabelFilter('', '', '=');
        expression = addFilterAsLabelFilter(expression, [lastPosition], filter);
        break;
      }
      case 'ADD_LINE_FILTER': {
        expression = addLineFilter(expression);
        break;
      }
      default:
        break;
    }
    return { ...query, expr: expression };
  }

  getTime(date: string | DateTime, roundUp: boolean) {
    if (typeof date === 'string') {
      date = dateMath.parse(date, roundUp)!;
    }

    return Math.ceil(date.valueOf() * 1e6);
  }

  getLogRowContext = async (
    row: LogRowModel,
    options?: LogRowContextOptions,
    origQuery?: DataQuery
  ): Promise<{ data: DataFrame[] }> => {
    return await this.logContextProvider.getLogRowContext(row, options, origQuery);
  };

  getLogRowContextUi(row: LogRowModel, runContextQuery: () => void): React.ReactNode {
    return this.logContextProvider.getLogRowContextUi(row, runContextQuery);
  }

  testDatasource(): Promise<{ status: string; message: string }> {
    // Consider only last 10 minutes otherwise request takes too long
    const nowMs = Date.now();
    const params = {
      start: (nowMs - 10 * 60 * 1000) * NS_IN_MS,
      end: nowMs * NS_IN_MS,
    };

    return this.metadataRequest('labels', params).then(
      (values) => {
        return values.length > 0
          ? { status: 'success', message: 'Data source successfully connected.' }
          : {
              status: 'error',
              message:
                'Data source connected, but no labels were received. Verify that Loki and Promtail are correctly configured.',
            };
      },
      (err) => {
        // we did a resource-call that failed.
        // the only info we have, if exists, is err.data.message
        // (when in development-mode, err.data.error exists too, but not in production-mode)
        // things like err.status & err.statusText does not help,
        // because those will only describe how the request between browser<>server failed
        const info: string = err?.data?.message ?? '';
        const infoInParentheses = info !== '' ? ` (${info})` : '';
        const message = `Unable to connect with Loki${infoInParentheses}. Please check the server logs for more details.`;
        return { status: 'error', message: message };
      }
    );
  }

  async annotationQuery(options: any): Promise<AnnotationEvent[]> {
    const { expr, maxLines, instant, tagKeys = '', titleFormat = '', textFormat = '' } = options.annotation;

    if (!expr) {
      return [];
    }

    const id = `${REF_ID_STARTER_ANNOTATION}${options.annotation.name}`;

    const query: LokiQuery = {
      refId: id,
      expr,
      maxLines,
      instant,
      queryType: instant ? LokiQueryType.Instant : LokiQueryType.Range,
    };

    const request = makeRequest(query, options.range, CoreApp.Dashboard, id);

    const { data } = await lastValueFrom(this.query(request));

    const annotations: AnnotationEvent[] = [];
    const splitKeys: string[] = tagKeys.split(',').filter((v: string) => v !== '');

    for (const frame of data) {
      const view = new DataFrameView<{ Time: string; Line: string; labels: Labels }>(frame);

      view.forEach((row) => {
        const { labels } = row;

        const maybeDuplicatedTags = Object.entries(labels)
          .map(([key, val]) => [key, val.trim()]) // trim all label-values
          .filter(([key, val]) => {
            if (val === '') {
              // remove empty
              return false;
            }

            // if tags are specified, remove label if does not match tags
            if (splitKeys.length && !splitKeys.includes(key)) {
              return false;
            }

            return true;
          })
          .map(([key, val]) => val); // keep only the label-value

        // remove duplicates
        const tags = Array.from(new Set(maybeDuplicatedTags));

        annotations.push({
          time: new Date(row.Time).valueOf(),
          title: renderLegendFormat(titleFormat, labels),
          text: renderLegendFormat(textFormat, labels) || row.Line,
          tags,
        });
      });
    }

    return annotations;
  }

  showContextToggle(row?: LogRowModel): boolean {
    return (row && row.searchWords && row.searchWords.length > 0) === true;
  }

  processError(err: FetchError, target: LokiQuery) {
    let error: DataQueryError = cloneDeep(err);
    error.refId = target.refId;

    if (error.data && err.data.message.includes('escape') && target.expr.includes('\\')) {
      error.data.message = `Error: ${err.data.message}. Make sure that all special characters are escaped with \\. For more information on escaping of special characters visit LogQL documentation at https://grafana.com/docs/loki/latest/logql/.`;
    }

    return error;
  }

  addAdHocFilters(queryExpr: string) {
    const adhocFilters = this.templateSrv.getAdhocFilters(this.name);
    let expr = replaceVariables(queryExpr);

    expr = adhocFilters.reduce((acc: string, filter: { key: string; operator: string; value: string }) => {
      const { key, operator } = filter;
      let { value } = filter;
      if (isRegexSelector(operator)) {
        // Adhoc filters don't support multiselect, therefore if user selects regex operator
        // we are going to consider value to be regex filter and use lokiRegularEscape
        // that does not escape regex special characters (e.g. .*test.* => .*test.*)
        value = lokiRegularEscape(value);
      } else {
        // Otherwise, we want to escape special characters in value
        value = escapeLabelValueInSelector(value, operator);
      }
      return addLabelToQuery(acc, key, operator, value);
    }, expr);

    return returnVariables(expr);
  }

  // Used when running queries through backend
  filterQuery(query: LokiQuery): boolean {
    if (query.hide || query.expr === '') {
      return false;
    }
    return true;
  }

  // Used when running queries through backend
  applyTemplateVariables(target: LokiQuery, scopedVars: ScopedVars): LokiQuery {
    // We want to interpolate these variables on backend
    const { __interval, __interval_ms, ...rest } = scopedVars || {};

    const exprWithAdHoc = this.addAdHocFilters(target.expr);

    return {
      ...target,
      legendFormat: this.templateSrv.replace(target.legendFormat, rest),
      expr: this.templateSrv.replace(exprWithAdHoc, rest, this.interpolateQueryExpr),
    };
  }

  interpolateString(string: string, scopedVars?: ScopedVars) {
    return this.templateSrv.replace(string, scopedVars, this.interpolateQueryExpr);
  }

  getVariables(): string[] {
    return this.templateSrv.getVariables().map((v) => `$${v.name}`);
  }

  getQueryHints(query: LokiQuery, result: DataFrame[]): QueryHint[] {
    return getQueryHints(query.expr, result);
  }
}

// NOTE: these two functions are very similar to the escapeLabelValueIn* functions
// in language_utils.ts, but they are not exactly the same algorithm, and we found
// no way to reuse one in the another or vice versa.
export function lokiRegularEscape(value: any) {
  if (typeof value === 'string') {
    return value.replace(/'/g, "\\\\'");
  }
  return value;
}

export function lokiSpecialRegexEscape(value: any) {
  if (typeof value === 'string') {
    return lokiRegularEscape(value.replace(/\\/g, '\\\\\\\\').replace(/[$^*{}\[\]+?.()|]/g, '\\\\$&'));
  }
  return value;
}

function extractLevel(dataFrame: DataFrame): LogLevel {
  let valueField;
  try {
    valueField = new FieldCache(dataFrame).getFirstFieldOfType(FieldType.number);
  } catch {}
  return valueField?.labels ? getLogLevelFromLabels(valueField.labels) : LogLevel.unknown;
}

function getLogLevelFromLabels(labels: Labels): LogLevel {
  const labelNames = ['level', 'lvl', 'loglevel'];
  let levelLabel;
  for (let labelName of labelNames) {
    if (labelName in labels) {
      levelLabel = labelName;
      break;
    }
  }
  return levelLabel ? getLogLevelFromKey(labels[levelLabel]) : LogLevel.unknown;
}
