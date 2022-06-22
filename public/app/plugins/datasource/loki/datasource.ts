// Libraries
import { cloneDeep, map as lodashMap } from 'lodash';
import Prism from 'prismjs';
import { lastValueFrom, merge, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

// Types
import {
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
  DataSourceWithLogsVolumeSupport,
  DataSourceWithQueryExportSupport,
  DataSourceWithQueryImportSupport,
  dateMath,
  DateTime,
  FieldCache,
  AbstractQuery,
  FieldType,
  getLogLevelFromKey,
  Labels,
  LoadingState,
  LogLevel,
  LogRowModel,
  ScopedVars,
  TimeRange,
  rangeUtil,
  toUtc,
} from '@grafana/data';
import { FetchError, config, DataSourceWithBackend } from '@grafana/runtime';
import { RowContextOptions } from '@grafana/ui/src/components/Logs/LogRowContextProvider';
import { queryLogsVolume } from 'app/core/logs_model';
import { convertToWebSocketUrl } from 'app/core/utils/explore';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';

import { serializeParams } from '../../../core/utils/fetch';
import { renderLegendFormat } from '../prometheus/legend';

import { addLabelToQuery } from './add_label_to_query';
import { transformBackendResult } from './backendResultTransformer';
import { LokiAnnotationsQueryEditor } from './components/AnnotationsQueryEditor';
import LanguageProvider from './language_provider';
import { escapeLabelValueInSelector } from './language_utils';
import { LiveStreams, LokiLiveTarget } from './live_streams';
import { addParsedLabelToQuery, getNormalizedLokiQuery, queryHasPipeParser } from './query_utils';
import { sortDataFrameByTime } from './sortDataFrame';
import { doLokiChannelStream } from './streaming';
import syntax from './syntax';
import { LokiOptions, LokiQuery, LokiQueryDirection, LokiQueryType } from './types';

export type RangeQueryOptions = DataQueryRequest<LokiQuery> | AnnotationQueryRequest<LokiQuery>;
export const DEFAULT_MAX_LINES = 1000;
export const LOKI_ENDPOINT = '/loki/api/v1';
const NS_IN_MS = 1000000;

function makeRequest(query: LokiQuery, range: TimeRange, app: CoreApp, requestId: string): DataQueryRequest<LokiQuery> {
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
  };
}

export class LokiDatasource
  extends DataSourceWithBackend<LokiQuery, LokiOptions>
  implements
    DataSourceWithLogsContextSupport,
    DataSourceWithLogsVolumeSupport<LokiQuery>,
    DataSourceWithQueryImportSupport<LokiQuery>,
    DataSourceWithQueryExportSupport<LokiQuery>
{
  private streams = new LiveStreams();
  languageProvider: LanguageProvider;
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
  }

  getLogsVolumeDataProvider(request: DataQueryRequest<LokiQuery>): Observable<DataQueryResponse> | undefined {
    const isQuerySuitable = (query: LokiQuery) => {
      const normalized = getNormalizedLokiQuery(query);
      const { expr } = normalized;
      // it has to be a logs-producing range-query
      return expr && !isMetricsQuery(expr) && normalized.queryType === LokiQueryType.Range;
    };

    const isLogsVolumeAvailable = request.targets.some(isQuerySuitable);

    if (!isLogsVolumeAvailable) {
      return undefined;
    }

    const logsVolumeRequest = cloneDeep(request);
    logsVolumeRequest.targets = logsVolumeRequest.targets.filter(isQuerySuitable).map((target) => {
      return {
        ...target,
        instant: false,
        volumeQuery: true,
        expr: `sum by (level) (count_over_time(${target.expr}[$__interval]))`,
      };
    });

    return queryLogsVolume(this, logsVolumeRequest, {
      extractLevel,
      range: request.range,
      targets: request.targets,
    });
  }

  query(request: DataQueryRequest<LokiQuery>): Observable<DataQueryResponse> {
    const queries = request.targets
      .map(getNormalizedLokiQuery) // "fix" the `.queryType` prop
      .map((q) => ({ ...q, maxLines: q.maxLines || this.maxLines })); // set maxLines if not set

    const fixedRequest = {
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
      return merge(...streamQueries.map((q) => doLokiChannelStream(q, this, streamRequest)));
    }

    if (fixedRequest.liveStreaming) {
      return this.runLiveQueryThroughBackend(fixedRequest);
    } else {
      return super
        .query(fixedRequest)
        .pipe(
          map((response) =>
            transformBackendResult(response, fixedRequest.targets, this.instanceSettings.jsonData.derivedFields ?? [])
          )
        );
    }
  }

  runLiveQueryThroughBackend(request: DataQueryRequest<LokiQuery>): Observable<DataQueryResponse> {
    // this only works in explore-mode, so variables don't need to be handled,
    //  and only for logs-queries, not metric queries
    const logsQueries = request.targets.filter((query) => query.expr !== '' && !isMetricsQuery(query.expr));

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

  getRangeScopedVars(range: TimeRange = this.timeSrv.timeRange()) {
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
        expr: this.templateSrv.replace(query.expr, scopedVars, this.interpolateQueryExpr),
      }));
    }

    return expandedQueries;
  }

  getQueryDisplayText(query: LokiQuery) {
    return query.expr;
  }

  getTimeRangeParams() {
    const timeRange = this.timeSrv.timeRange();
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

  async metadataRequest(url: string, params?: Record<string, string | number>) {
    // url must not start with a `/`, otherwise the AJAX-request
    // going from the browser will contain `//`, which can cause problems.
    if (url.startsWith('/')) {
      throw new Error(`invalid metadata request url: ${url}`);
    }

    const res = await this.getResource(url, params);
    return res.data || [];
  }

  async metricFindQuery(query: string) {
    if (!query) {
      return Promise.resolve([]);
    }

    const interpolated = this.templateSrv.replace(query, {}, this.interpolateQueryExpr);
    return await this.processMetricFindQuery(interpolated);
  }

  async processMetricFindQuery(query: string) {
    const labelNamesRegex = /^label_names\(\)\s*$/;
    const labelValuesRegex = /^label_values\((?:(.+),\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\)\s*$/;

    const labelNames = query.match(labelNamesRegex);
    if (labelNames) {
      return await this.labelNamesQuery();
    }

    const labelValues = query.match(labelValuesRegex);
    if (labelValues) {
      // If we have query expr, use /series endpoint
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

  // By implementing getTagKeys and getTagValues we add ad-hoc filtters functionality
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

  modifyQuery(query: LokiQuery, action: any): LokiQuery {
    let expression = query.expr ?? '';
    switch (action.type) {
      case 'ADD_FILTER': {
        expression = this.addLabelToQuery(expression, action.key, action.value, '=');
        break;
      }
      case 'ADD_FILTER_OUT': {
        expression = this.addLabelToQuery(expression, action.key, action.value, '!=');
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

  getLogRowContext = (row: LogRowModel, options?: RowContextOptions): Promise<{ data: DataFrame[] }> => {
    const direction = (options && options.direction) || 'BACKWARD';
    const limit = (options && options.limit) || 10;
    const { query, range } = this.prepareLogRowContextQueryTarget(row, limit, direction);

    const processDataFrame = (frame: DataFrame): DataFrame => {
      // log-row-context requires specific field-names to work, so we set them here: "ts", "line", "id"
      const cache = new FieldCache(frame);
      const timestampField = cache.getFirstFieldOfType(FieldType.time);
      const lineField = cache.getFirstFieldOfType(FieldType.string);
      const idField = cache.getFieldByName('id');

      if (timestampField === undefined || lineField === undefined || idField === undefined) {
        // this should never really happen, but i want to keep typescript happy
        return { ...frame, fields: [] };
      }

      return {
        ...frame,
        fields: [
          {
            ...timestampField,
            name: 'ts',
          },
          {
            ...lineField,
            name: 'line',
          },
          {
            ...idField,
            name: 'id',
          },
        ],
      };
    };

    const processResults = (result: DataQueryResponse): DataQueryResponse => {
      const frames: DataFrame[] = result.data;
      const processedFrames = frames
        .map((frame) => sortDataFrameByTime(frame, 'DESCENDING'))
        .map((frame) => processDataFrame(frame)); // rename fields if needed

      return {
        ...result,
        data: processedFrames,
      };
    };

    // this can only be called from explore currently
    const app = CoreApp.Explore;

    return lastValueFrom(
      this.query(makeRequest(query, range, app, `log-row-context-query-${direction}`)).pipe(
        catchError((err) => {
          const error: DataQueryError = {
            message: 'Error during context query. Please check JS console logs.',
            status: err.status,
            statusText: err.statusText,
          };
          throw error;
        }),
        switchMap((res) => of(processResults(res)))
      )
    );
  };

  prepareLogRowContextQueryTarget = (
    row: LogRowModel,
    limit: number,
    direction: 'BACKWARD' | 'FORWARD'
  ): { query: LokiQuery; range: TimeRange } => {
    const labels = this.languageProvider.getLabelKeys();
    const expr = Object.keys(row.labels)
      .map((label: string) => {
        if (labels.includes(label)) {
          // escape backslashes in label as users can't escape them by themselves
          return `${label}="${row.labels[label].replace(/\\/g, '\\\\')}"`;
        }
        return '';
      })
      // Filter empty strings
      .filter((label) => !!label)
      .join(',');

    const contextTimeBuffer = 2 * 60 * 60 * 1000; // 2h buffer

    const queryDirection = direction === 'FORWARD' ? LokiQueryDirection.Forward : LokiQueryDirection.Backward;

    const query: LokiQuery = {
      expr: `{${expr}}`,
      queryType: LokiQueryType.Range,
      refId: '',
      maxLines: limit,
      direction: queryDirection,
    };

    const fieldCache = new FieldCache(row.dataFrame);
    const tsField = fieldCache.getFirstFieldOfType(FieldType.time);
    if (tsField === undefined) {
      throw new Error('loki: dataframe missing time-field, should never happen');
    }
    const tsValue = tsField.values.get(row.rowIndex);
    const timestamp = toUtc(tsValue);

    const range =
      queryDirection === LokiQueryDirection.Forward
        ? {
            // start param in Loki API is inclusive so we'll have to filter out the row that this request is based from
            // and any other that were logged in the same ns but before the row. Right now these rows will be lost
            // because the are before but came it he response that should return only rows after.
            from: timestamp,
            // convert to ns, we loose some precision here but it is not that important at the far points of the context
            to: toUtc(row.timeEpochMs + contextTimeBuffer),
          }
        : {
            // convert to ns, we loose some precision here but it is not that important at the far points of the context
            from: toUtc(row.timeEpochMs - contextTimeBuffer),
            to: timestamp,
          };

    return {
      query,
      range: {
        from: range.from,
        to: range.to,
        raw: range,
      },
    };
  };

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
          ? { status: 'success', message: 'Data source connected and labels found.' }
          : {
              status: 'error',
              message:
                'Data source connected, but no labels received. Verify that Loki and Promtail is configured properly.',
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
        const message = `Unable to fetch labels from Loki${infoInParentheses}, please check the server logs for more details`;
        return { status: 'error', message: message };
      }
    );
  }

  async annotationQuery(options: any): Promise<AnnotationEvent[]> {
    const { expr, maxLines, instant, tagKeys = '', titleFormat = '', textFormat = '' } = options.annotation;

    if (!expr) {
      return [];
    }

    const id = `annotation-${options.annotation.name}`;

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
    let expr = queryExpr;

    expr = adhocFilters.reduce((acc: string, filter: { key?: any; operator?: any; value?: any }) => {
      const { key, operator } = filter;
      let { value } = filter;
      return this.addLabelToQuery(acc, key, value, operator, true);
    }, expr);

    return expr;
  }

  addLabelToQuery(
    queryExpr: string,
    key: string,
    value: string | number,
    operator: string,
    // Override to make sure that we use label as actual label and not parsed label
    notParsedLabelOverride?: boolean
  ) {
    let escapedValue = escapeLabelValueInSelector(value.toString(), operator);

    if (queryHasPipeParser(queryExpr) && !isMetricsQuery(queryExpr) && !notParsedLabelOverride) {
      // If query has parser, we treat all labels as parsed and use | key="value" syntax
      return addParsedLabelToQuery(queryExpr, key, escapedValue, operator);
    } else {
      return addLabelToQuery(queryExpr, key, escapedValue, operator, true);
    }
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
    const { __interval, __interval_ms, ...rest } = scopedVars;

    const exprWithAdHoc = this.addAdHocFilters(target.expr);

    return {
      ...target,
      legendFormat: this.templateSrv.replace(target.legendFormat, rest),
      expr: this.templateSrv.replace(exprWithAdHoc, rest, this.interpolateQueryExpr),
    };
  }

  interpolateString(string: string) {
    return this.templateSrv.replace(string, undefined, this.interpolateQueryExpr);
  }

  getVariables(): string[] {
    return this.templateSrv.getVariables().map((v) => `$${v.name}`);
  }
}

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

/**
 * Checks if the query expression uses function and so should return a time series instead of logs.
 * Sometimes important to know that before we actually do the query.
 */
export function isMetricsQuery(query: string): boolean {
  if (!query) {
    return false;
  }
  const tokens = Prism.tokenize(query, syntax);
  return tokens.some((t) => {
    // Not sure in which cases it can be string maybe if nothing matched which means it should not be a function
    return typeof t !== 'string' && t.type === 'function';
  });
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
