// Libraries
import { cloneDeep, isEmpty, map as lodashMap } from 'lodash';
import { lastValueFrom, merge, Observable, of, throwError } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import Prism from 'prismjs';

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
  QueryResultMeta,
  ScopedVars,
  TimeRange,
} from '@grafana/data';
import { BackendSrvRequest, FetchError, getBackendSrv, DataSourceWithBackend } from '@grafana/runtime';
import { getTemplateSrv, TemplateSrv } from 'app/features/templating/template_srv';
import { addLabelToQuery } from './add_label_to_query';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { convertToWebSocketUrl } from 'app/core/utils/explore';
import {
  lokiResultsToTableModel,
  lokiStreamResultToDataFrame,
  lokiStreamsToDataFrames,
  processRangeQueryResponse,
} from './result_transformer';
import { transformBackendResult } from './backendResultTransformer';
import { addParsedLabelToQuery, getNormalizedLokiQuery, queryHasPipeParser } from './query_utils';

import {
  LokiOptions,
  LokiQuery,
  LokiQueryType,
  LokiRangeQueryRequest,
  LokiResultType,
  LokiStreamResponse,
  LokiStreamResult,
} from './types';
import { LiveStreams, LokiLiveTarget } from './live_streams';
import LanguageProvider from './language_provider';
import { serializeParams } from '../../../core/utils/fetch';
import { RowContextOptions } from '@grafana/ui/src/components/Logs/LogRowContextProvider';
import syntax from './syntax';
import { DEFAULT_RESOLUTION } from './components/LokiOptionFields';
import { queryLogsVolume } from 'app/core/logs_model';
import config from 'app/core/config';
import { renderLegendFormat } from '../prometheus/legend';

export type RangeQueryOptions = DataQueryRequest<LokiQuery> | AnnotationQueryRequest<LokiQuery>;
export const DEFAULT_MAX_LINES = 1000;
export const LOKI_ENDPOINT = '/loki/api/v1';
const NS_IN_MS = 1000000;

const RANGE_QUERY_ENDPOINT = `${LOKI_ENDPOINT}/query_range`;
const INSTANT_QUERY_ENDPOINT = `${LOKI_ENDPOINT}/query`;

const DEFAULT_QUERY_PARAMS: Partial<LokiRangeQueryRequest> = {
  direction: 'BACKWARD',
  limit: DEFAULT_MAX_LINES,
  query: '',
};

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
  }

  _request(apiUrl: string, data?: any, options?: Partial<BackendSrvRequest>): Observable<Record<string, any>> {
    const baseUrl = this.instanceSettings.url;
    const params = data ? serializeParams(data) : '';
    const url = `${baseUrl}${apiUrl}${params.length ? `?${params}` : ''}`;
    if (this.instanceSettings.withCredentials || this.instanceSettings.basicAuth) {
      options = { ...options, withCredentials: true };
      if (this.instanceSettings.basicAuth) {
        options.headers = { ...options.headers, Authorization: this.instanceSettings.basicAuth };
      }
    }
    const req = {
      ...options,
      url,
    };

    return getBackendSrv().fetch<Record<string, any>>(req);
  }

  getLogsVolumeDataProvider(request: DataQueryRequest<LokiQuery>): Observable<DataQueryResponse> | undefined {
    const isLogsVolumeAvailable = request.targets.some((target) => target.expr && !isMetricsQuery(target.expr));
    if (!isLogsVolumeAvailable) {
      return undefined;
    }

    const logsVolumeRequest = cloneDeep(request);
    logsVolumeRequest.targets = logsVolumeRequest.targets
      .filter((target) => target.expr && !isMetricsQuery(target.expr))
      .map((target) => {
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
    const subQueries: Array<Observable<DataQueryResponse>> = [];
    const scopedVars = {
      ...request.scopedVars,
      ...this.getRangeScopedVars(request.range),
    };

    const shouldRunBackendQuery = config.featureToggles.lokiBackendMode && request.app === CoreApp.Explore;

    if (shouldRunBackendQuery) {
      // we "fix" the loki queries to have `.queryType` and not have `.instant` and `.range`
      const fixedRequest = {
        ...request,
        targets: request.targets.map(getNormalizedLokiQuery),
      };
      return super.query(fixedRequest).pipe(map((response) => transformBackendResult(response, fixedRequest)));
    }

    const filteredTargets = request.targets
      .filter((target) => target.expr && !target.hide)
      .map((target) => {
        const expr = this.addAdHocFilters(target.expr);
        return {
          ...target,
          expr: this.templateSrv.replace(expr, scopedVars, this.interpolateQueryExpr),
        };
      });

    for (const target of filteredTargets) {
      if (target.instant || target.queryType === LokiQueryType.Instant) {
        subQueries.push(this.runInstantQuery(target, request, filteredTargets.length));
      } else {
        subQueries.push(this.runRangeQuery(target, request, filteredTargets.length));
      }
    }

    // No valid targets, return the empty result to save a round trip.
    if (isEmpty(subQueries)) {
      return of({
        data: [],
        state: LoadingState.Done,
      });
    }

    return merge(...subQueries);
  }

  runInstantQuery = (
    target: LokiQuery,
    options: DataQueryRequest<LokiQuery>,
    responseListLength = 1
  ): Observable<DataQueryResponse> => {
    const timeNs = this.getTime(options.range.to, true);
    const queryLimit = isMetricsQuery(target.expr) ? options.maxDataPoints : target.maxLines;
    const query = {
      query: target.expr,
      time: `${timeNs + (1e9 - (timeNs % 1e9))}`,
      limit: Math.min(queryLimit || Infinity, this.maxLines),
    };

    /** Used only for results of metrics instant queries */
    const meta: QueryResultMeta = {
      preferredVisualisationType: 'table',
    };

    return this._request(INSTANT_QUERY_ENDPOINT, query).pipe(
      map((response) => {
        if (response.data.data.resultType === LokiResultType.Stream) {
          return {
            data: response.data
              ? lokiStreamsToDataFrames(
                  response.data as LokiStreamResponse,
                  target,
                  query.limit,
                  this.instanceSettings.jsonData
                )
              : [],
            key: `${target.refId}_instant`,
          };
        }

        return {
          data: [lokiResultsToTableModel(response.data.data.result, responseListLength, target.refId, meta, true)],
          key: `${target.refId}_instant`,
        };
      }),
      catchError((err) => throwError(() => this.processError(err, target)))
    );
  };

  createRangeQuery(target: LokiQuery, options: RangeQueryOptions, limit: number): LokiRangeQueryRequest {
    const query = target.expr;
    let range: { start?: number; end?: number; step?: number } = {};
    if (options.range) {
      const startNs = this.getTime(options.range.from, false);
      const endNs = this.getTime(options.range.to, true);
      const rangeMs = Math.ceil((endNs - startNs) / 1e6);

      const resolution = target.resolution || (DEFAULT_RESOLUTION.value as number);

      const adjustedInterval =
        this.adjustInterval((options as DataQueryRequest<LokiQuery>).intervalMs || 1000, resolution, rangeMs) / 1000;
      // We want to ceil to 3 decimal places
      const step = Math.ceil(adjustedInterval * 1000) / 1000;

      range = {
        start: startNs,
        end: endNs,
        step,
      };
    }

    return {
      ...DEFAULT_QUERY_PARAMS,
      ...range,
      query,
      limit,
    };
  }

  /**
   * Attempts to send a query to /loki/api/v1/query_range
   */
  runRangeQuery = (
    target: LokiQuery,
    options: RangeQueryOptions,
    responseListLength = 1
  ): Observable<DataQueryResponse> => {
    // For metric query we use maxDataPoints from the request options which should be something like width of the
    // visualisation in pixels. In case of logs request we either use lines limit defined in the query target or
    // global limit defined for the data source which ever is lower.
    let maxDataPoints = isMetricsQuery(target.expr)
      ? // We fallback to maxLines here because maxDataPoints is defined as possibly undefined. Not sure that can
        // actually happen both Dashboards and Explore should send some value here. If not maxLines does not make that
        // much sense but nor any other arbitrary value.
        (options as DataQueryRequest<LokiQuery>).maxDataPoints || this.maxLines
      : // If user wants maxLines 0 we still fallback to data source limit. I think that makes sense as why would anyone
        // want to do a query and not see any results?
        target.maxLines || this.maxLines;

    if ((options as DataQueryRequest<LokiQuery>).liveStreaming) {
      return this.runLiveQuery(target, maxDataPoints);
    }
    const query = this.createRangeQuery(target, options, maxDataPoints);

    const headers = target.volumeQuery ? { 'X-Query-Tags': 'Source=logvolhist' } : undefined;

    return this._request(RANGE_QUERY_ENDPOINT, query, { headers }).pipe(
      catchError((err) => throwError(() => this.processError(err, target))),
      switchMap((response) =>
        processRangeQueryResponse(
          response.data,
          target,
          query,
          responseListLength,
          maxDataPoints,
          this.instanceSettings.jsonData,
          (options as DataQueryRequest<LokiQuery>).scopedVars,
          (options as DataQueryRequest<LokiQuery>).reverse
        )
      )
    );
  };

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
    const res = await lastValueFrom(this._request(url, params, { hideFromInspector: true }));
    return res.data.data || res.data.values || [];
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
    const url = `${LOKI_ENDPOINT}/label`;
    const params = this.getTimeRangeParams();
    const result = await this.metadataRequest(url, params);
    return result.map((value: string) => ({ text: value }));
  }

  async labelValuesQuery(label: string) {
    const params = this.getTimeRangeParams();
    const url = `${LOKI_ENDPOINT}/label/${label}/values`;
    const result = await this.metadataRequest(url, params);
    return result.map((value: string) => ({ text: value }));
  }

  async labelValuesSeriesQuery(expr: string, label: string) {
    const timeParams = this.getTimeRangeParams();
    const params = {
      ...timeParams,
      'match[]': expr,
    };
    const url = `${LOKI_ENDPOINT}/series`;
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
    const target = this.prepareLogRowContextQueryTarget(
      row,
      (options && options.limit) || 10,
      (options && options.direction) || 'BACKWARD'
    );

    const reverse = options && options.direction === 'FORWARD';
    return lastValueFrom(
      this._request(RANGE_QUERY_ENDPOINT, target).pipe(
        catchError((err) => {
          const error: DataQueryError = {
            message: 'Error during context query. Please check JS console logs.',
            status: err.status,
            statusText: err.statusText,
          };
          throw error;
        }),
        switchMap((res) =>
          of({
            data: res.data
              ? res.data.data.result.map((stream: LokiStreamResult) => lokiStreamResultToDataFrame(stream, reverse))
              : [],
          })
        )
      )
    );
  };

  prepareLogRowContextQueryTarget = (row: LogRowModel, limit: number, direction: 'BACKWARD' | 'FORWARD') => {
    const labels = this.languageProvider.getLabelKeys();
    const query = Object.keys(row.labels)
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
    const commonTargetOptions = {
      limit,
      query: `{${query}}`,
      expr: `{${query}}`,
      direction,
    };

    const fieldCache = new FieldCache(row.dataFrame);
    const nsField = fieldCache.getFieldByName('tsNs')!;
    const nsTimestamp = nsField.values.get(row.rowIndex);

    if (direction === 'BACKWARD') {
      return {
        ...commonTargetOptions,
        // convert to ns, we loose some precision here but it is not that important at the far points of the context
        start: row.timeEpochMs - contextTimeBuffer + '000000',
        end: nsTimestamp,
        direction,
      };
    } else {
      return {
        ...commonTargetOptions,
        // start param in Loki API is inclusive so we'll have to filter out the row that this request is based from
        // and any other that were logged in the same ns but before the row. Right now these rows will be lost
        // because the are before but came it he response that should return only rows after.
        start: nsTimestamp,
        // convert to ns, we loose some precision here but it is not that important at the far points of the context
        end: row.timeEpochMs + contextTimeBuffer + '000000',
      };
    }
  };

  testDatasource() {
    // Consider only last 10 minutes otherwise request takes too long
    const startMs = Date.now() - 10 * 60 * 1000;
    const start = `${startMs}000000`; // API expects nanoseconds
    return lastValueFrom(
      this._request(`${LOKI_ENDPOINT}/label`, { start }).pipe(
        map((res) => {
          const values: any[] = res?.data?.data || res?.data?.values || [];
          const testResult =
            values.length > 0
              ? { status: 'success', message: 'Data source connected and labels found.' }
              : {
                  status: 'error',
                  message:
                    'Data source connected, but no labels received. Verify that Loki and Promtail is configured properly.',
                };
          return testResult;
        }),
        catchError((err: any) => {
          let message = 'Loki: ';
          if (err.statusText) {
            message += err.statusText;
          } else {
            message += 'Cannot connect to Loki';
          }

          if (err.status) {
            message += `. ${err.status}`;
          }

          if (err.data && err.data.message) {
            message += `. ${err.data.message}`;
          } else if (err.data) {
            message += `. ${err.data}`;
          }
          return of({ status: 'error', message: message });
        })
      )
    );
  }

  async annotationQuery(options: any): Promise<AnnotationEvent[]> {
    const {
      expr,
      maxLines,
      instant,
      stepInterval,
      tagKeys = '',
      titleFormat = '',
      textFormat = '',
    } = options.annotation;

    if (!expr) {
      return [];
    }

    const interpolatedExpr = this.templateSrv.replace(expr, {}, this.interpolateQueryExpr);
    const query = {
      refId: `annotation-${options.annotation.name}`,
      expr: interpolatedExpr,
      maxLines,
      instant,
      stepInterval,
      queryType: instant ? LokiQueryType.Instant : LokiQueryType.Range,
    };
    const { data } = instant
      ? await lastValueFrom(this.runInstantQuery(query, options as any))
      : await lastValueFrom(this.runRangeQuery(query, options as any));

    const annotations: AnnotationEvent[] = [];
    const splitKeys: string[] = tagKeys.split(',').filter((v: string) => v !== '');

    for (const frame of data) {
      const labels: { [key: string]: string } = {};
      for (const field of frame.fields) {
        if (field.labels) {
          for (const [key, value] of Object.entries(field.labels)) {
            labels[key] = String(value).trim();
          }
        }
      }

      const tags: string[] = [
        ...new Set(
          Object.entries(labels).reduce((acc: string[], [key, val]) => {
            if (val === '') {
              return acc;
            }
            if (splitKeys.length && !splitKeys.includes(key)) {
              return acc;
            }
            acc.push.apply(acc, [val]);
            return acc;
          }, [])
        ),
      ];

      const view = new DataFrameView<{ ts: string; line: string }>(frame);

      view.forEach((row) => {
        annotations.push({
          time: new Date(row.ts).valueOf(),
          title: renderLegendFormat(titleFormat, labels),
          text: renderLegendFormat(textFormat, labels) || row.line,
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
    let error = cloneDeep(err);
    if (err.data.message.includes('escape') && target.expr.includes('\\')) {
      error.data.message = `Error: ${err.data.message}. Make sure that all special characters are escaped with \\. For more information on escaping of special characters visit LogQL documentation at https://grafana.com/docs/loki/latest/logql/.`;
    }
    return error;
  }

  adjustInterval(dynamicInterval: number, resolution: number, range: number) {
    // Loki will drop queries that might return more than 11000 data points.
    // Calibrate interval if it is too small.
    let safeInterval = range / 11000;
    if (safeInterval > 1) {
      safeInterval = Math.ceil(safeInterval);
    }

    let adjustedInterval = Math.max(resolution * dynamicInterval, safeInterval);
    return adjustedInterval;
  }

  addAdHocFilters(queryExpr: string) {
    const adhocFilters = this.templateSrv.getAdhocFilters(this.name);
    let expr = queryExpr;

    expr = adhocFilters.reduce((acc: string, filter: { key?: any; operator?: any; value?: any }) => {
      const { key, operator } = filter;
      let { value } = filter;
      if (operator === '=~' || operator === '!~') {
        value = lokiRegularEscape(value);
      }

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
    if (queryHasPipeParser(queryExpr) && !isMetricsQuery(queryExpr) && !notParsedLabelOverride) {
      // If query has parser, we treat all labels as parsed and use | key="value" syntax
      return addParsedLabelToQuery(queryExpr, key, value, operator);
    } else {
      return addLabelToQuery(queryExpr, key, value, operator, true);
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
  applyTemplateVariables(target: LokiQuery, scopedVars: ScopedVars): Record<string, any> {
    // We want to interpolate these variables on backend
    const { __interval, __interval_ms, ...rest } = scopedVars;

    return {
      ...target,
      legendFormat: this.templateSrv.replace(target.legendFormat, rest),
      expr: this.templateSrv.replace(target.expr, rest, this.interpolateQueryExpr),
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

export default LokiDatasource;
