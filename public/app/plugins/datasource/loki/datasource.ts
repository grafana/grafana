// Libraries
import { isEmpty, map as lodashMap } from 'lodash';
import { Observable, from, merge, of, iif, defer } from 'rxjs';
import { map, filter, catchError, switchMap, mergeMap } from 'rxjs/operators';

// Services & Utils
import { DataFrame, dateMath, FieldCache } from '@grafana/data';
import { addLabelToSelector, keepSelectorFilters } from 'app/plugins/datasource/prometheus/add_label_to_query';
import { DatasourceRequestOptions } from 'app/core/services/backend_srv';
import { getBackendSrv } from '@grafana/runtime';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { safeStringifyValue, convertToWebSocketUrl } from 'app/core/utils/explore';
import {
  lokiResultsToTableModel,
  processRangeQueryResponse,
  legacyLogStreamToDataFrame,
  lokiStreamResultToDataFrame,
  lokiLegacyStreamsToDataframes,
} from './result_transformer';
import { formatQuery, parseQuery, getHighlighterExpressionsFromQuery } from './query_utils';

// Types
import {
  LogRowModel,
  DateTime,
  LoadingState,
  AnnotationEvent,
  DataFrameView,
  TimeRange,
  TimeSeries,
  PluginMeta,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  AnnotationQueryRequest,
  ExploreMode,
  ScopedVars,
} from '@grafana/data';

import {
  LokiQuery,
  LokiOptions,
  LokiLegacyQueryRequest,
  LokiLegacyStreamResponse,
  LokiResponse,
  LokiResultType,
  LokiRangeQueryRequest,
  LokiStreamResponse,
} from './types';
import { LegacyTarget, LiveStreams } from './live_streams';
import LanguageProvider from './language_provider';

export type RangeQueryOptions = Pick<DataQueryRequest<LokiQuery>, 'range' | 'intervalMs' | 'maxDataPoints' | 'reverse'>;
export const DEFAULT_MAX_LINES = 1000;
export const LEGACY_LOKI_ENDPOINT = '/api/prom';
export const LOKI_ENDPOINT = '/loki/api/v1';

const LEGACY_QUERY_ENDPOINT = `${LEGACY_LOKI_ENDPOINT}/query`;
const RANGE_QUERY_ENDPOINT = `${LOKI_ENDPOINT}/query_range`;
const INSTANT_QUERY_ENDPOINT = `${LOKI_ENDPOINT}/query`;

const DEFAULT_QUERY_PARAMS: Partial<LokiLegacyQueryRequest> = {
  direction: 'BACKWARD',
  limit: DEFAULT_MAX_LINES,
  regexp: '',
  query: '',
};

function serializeParams(data: Record<string, any>) {
  return Object.keys(data)
    .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`)
    .join('&');
}

interface LokiContextQueryOptions {
  direction?: 'BACKWARD' | 'FORWARD';
  limit?: number;
}

export class LokiDatasource extends DataSourceApi<LokiQuery, LokiOptions> {
  private streams = new LiveStreams();
  private version: string;
  languageProvider: LanguageProvider;
  maxLines: number;

  /** @ngInject */
  constructor(private instanceSettings: DataSourceInstanceSettings<LokiOptions>, private templateSrv: TemplateSrv) {
    super(instanceSettings);

    this.languageProvider = new LanguageProvider(this);
    const settingsData = instanceSettings.jsonData || {};
    this.maxLines = parseInt(settingsData.maxLines, 10) || DEFAULT_MAX_LINES;
  }

  getVersion() {
    if (this.version) {
      return Promise.resolve(this.version);
    }

    return this._request(RANGE_QUERY_ENDPOINT)
      .toPromise()
      .then(() => {
        this.version = 'v1';
        return this.version;
      })
      .catch((err: any) => {
        this.version = err.status !== 404 ? 'v1' : 'v0';
        return this.version;
      });
  }

  _request(apiUrl: string, data?: any, options?: DatasourceRequestOptions): Observable<Record<string, any>> {
    const baseUrl = this.instanceSettings.url;
    const params = data ? serializeParams(data) : '';
    const url = `${baseUrl}${apiUrl}${params.length ? `?${params}` : ''}`;
    const req = {
      ...options,
      url,
    };

    return from(getBackendSrv().datasourceRequest(req));
  }

  query(options: DataQueryRequest<LokiQuery>): Observable<DataQueryResponse> {
    const subQueries: Array<Observable<DataQueryResponse>> = [];
    const filteredTargets = options.targets
      .filter(target => target.expr && !target.hide)
      .map(target => ({
        ...target,
        expr: this.templateSrv.replace(target.expr, options.scopedVars, this.interpolateQueryExpr),
      }));

    if (options.exploreMode === ExploreMode.Metrics) {
      filteredTargets.forEach(target =>
        subQueries.push(
          this.runInstantQuery(target, options, filteredTargets.length),
          this.runRangeQueryWithFallback(target, options, filteredTargets.length)
        )
      );
    } else {
      filteredTargets.forEach(target =>
        subQueries.push(
          this.runRangeQueryWithFallback(target, options, filteredTargets.length).pipe(
            map(dataQueryResponse => {
              if (options.exploreMode === ExploreMode.Logs && dataQueryResponse.data.find(d => isTimeSeries(d))) {
                throw new Error(
                  'Logs mode does not support queries that return time series data. Please perform a logs query or switch to Metrics mode.'
                );
              } else {
                return dataQueryResponse;
              }
            })
          )
        )
      );
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

  runLegacyQuery = (
    target: LokiQuery,
    options: { range?: TimeRange; maxDataPoints?: number; reverse?: boolean }
  ): Observable<DataQueryResponse> => {
    if (target.liveStreaming) {
      return this.runLiveQuery(target, options);
    }

    const range = options.range
      ? { start: this.getTime(options.range.from, false), end: this.getTime(options.range.to, true) }
      : {};
    const query: LokiLegacyQueryRequest = {
      ...DEFAULT_QUERY_PARAMS,
      ...parseQuery(target.expr),
      ...range,
      limit: Math.min(options.maxDataPoints || Infinity, this.maxLines),
      refId: target.refId,
    };

    return this._request(LEGACY_QUERY_ENDPOINT, query).pipe(
      catchError((err: any) => this.throwUnless(err, err.cancelled, target)),
      filter((response: any) => !response.cancelled),
      map((response: { data: LokiLegacyStreamResponse }) => ({
        data: lokiLegacyStreamsToDataframes(
          response.data,
          query,
          this.maxLines,
          this.instanceSettings.jsonData,
          options.reverse
        ),
        key: `${target.refId}_log`,
      }))
    );
  };

  runInstantQuery = (
    target: LokiQuery,
    options: DataQueryRequest<LokiQuery>,
    responseListLength: number
  ): Observable<DataQueryResponse> => {
    const timeNs = this.getTime(options.range.to, true);
    const query = {
      query: parseQuery(target.expr).query,
      time: `${timeNs + (1e9 - (timeNs % 1e9))}`,
      limit: Math.min(options.maxDataPoints || Infinity, this.maxLines),
    };

    return this._request(INSTANT_QUERY_ENDPOINT, query).pipe(
      catchError((err: any) => this.throwUnless(err, err.cancelled, target)),
      filter((response: any) => (response.cancelled ? false : true)),
      map((response: { data: LokiResponse }) => {
        if (response.data.data.resultType === LokiResultType.Stream) {
          throw new Error('Metrics mode does not support logs. Use an aggregation or switch to Logs mode.');
        }

        return {
          data: [lokiResultsToTableModel(response.data.data.result, responseListLength, target.refId, true)],
          key: `${target.refId}_instant`,
        };
      })
    );
  };

  createRangeQuery(target: LokiQuery, options: RangeQueryOptions): LokiRangeQueryRequest {
    const { query } = parseQuery(target.expr);
    let range: { start?: number; end?: number; step?: number } = {};
    if (options.range) {
      const startNs = this.getTime(options.range.from, false);
      const endNs = this.getTime(options.range.to, true);
      const rangeMs = Math.ceil((endNs - startNs) / 1e6);
      const step = Math.ceil(this.adjustInterval(options.intervalMs || 1000, rangeMs) / 1000);
      const alignedTimes = {
        start: startNs - (startNs % 1e9),
        end: endNs + (1e9 - (endNs % 1e9)),
      };

      range = {
        start: alignedTimes.start,
        end: alignedTimes.end,
        step,
      };
    }

    return {
      ...DEFAULT_QUERY_PARAMS,
      ...range,
      query,
      limit: Math.min(options.maxDataPoints || Infinity, this.maxLines),
    };
  }

  /**
   * Attempts to send a query to /loki/api/v1/query_range but falls back to the legacy endpoint if necessary.
   */
  runRangeQueryWithFallback = (
    target: LokiQuery,
    options: RangeQueryOptions,
    responseListLength = 1
  ): Observable<DataQueryResponse> => {
    // target.maxLines value already preprocessed
    // available cases:
    // 1) empty input -> mapped to NaN, falls back to dataSource.maxLines limit
    // 2) input with at least 1 character and that is either incorrect (value in the input field is not a number) or negative
    //    - mapped to 0, falls back to the limit of 0 lines
    // 3) default case - correct input, mapped to the value from the input field

    let linesLimit = 0;
    if (target.maxLines === undefined) {
      // no target.maxLines, using options.maxDataPoints
      linesLimit = Math.min(options.maxDataPoints || Infinity, this.maxLines);
    } else {
      // using target.maxLines
      if (isNaN(target.maxLines)) {
        linesLimit = this.maxLines;
      } else {
        linesLimit = target.maxLines;
      }
    }

    const queryOptions = { ...options, maxDataPoints: linesLimit };
    if (target.liveStreaming) {
      return this.runLiveQuery(target, queryOptions);
    }
    const query = this.createRangeQuery(target, queryOptions);
    return this._request(RANGE_QUERY_ENDPOINT, query).pipe(
      catchError((err: any) => this.throwUnless(err, err.cancelled || err.status === 404, target)),
      filter((response: any) => (response.cancelled ? false : true)),
      switchMap((response: { data: LokiResponse; status: number }) =>
        iif<DataQueryResponse, DataQueryResponse>(
          () => response.status === 404,
          defer(() => this.runLegacyQuery(target, queryOptions)),
          defer(() =>
            processRangeQueryResponse(
              response.data,
              target,
              query,
              responseListLength,
              linesLimit,
              this.instanceSettings.jsonData,
              options.reverse
            )
          )
        )
      )
    );
  };

  createLegacyLiveTarget(target: LokiQuery, options: { maxDataPoints?: number }): LegacyTarget {
    const { query, regexp } = parseQuery(target.expr);
    const baseUrl = this.instanceSettings.url;
    const params = serializeParams({ query });

    return {
      query,
      regexp,
      url: convertToWebSocketUrl(`${baseUrl}/api/prom/tail?${params}`),
      refId: target.refId,
      size: Math.min(options.maxDataPoints || Infinity, this.maxLines),
    };
  }

  createLiveTarget(target: LokiQuery, options: { maxDataPoints?: number }): LegacyTarget {
    const { query, regexp } = parseQuery(target.expr);
    const baseUrl = this.instanceSettings.url;
    const params = serializeParams({ query });

    return {
      query,
      regexp,
      url: convertToWebSocketUrl(`${baseUrl}/loki/api/v1/tail?${params}`),
      refId: target.refId,
      size: Math.min(options.maxDataPoints || Infinity, this.maxLines),
    };
  }

  /**
   * Runs live queries which in this case means creating a websocket and listening on it for new logs.
   * This returns a bit different dataFrame than runQueries as it returns single dataframe even if there are multiple
   * Loki streams, sets only common labels on dataframe.labels and has additional dataframe.fields.labels for unique
   * labels per row.
   */
  runLiveQuery = (target: LokiQuery, options: { maxDataPoints?: number }): Observable<DataQueryResponse> => {
    const liveTarget = this.createLiveTarget(target, options);

    return from(this.getVersion()).pipe(
      mergeMap(version =>
        iif(
          () => version === 'v1',
          defer(() => this.streams.getStream(liveTarget)),
          defer(() => {
            const legacyTarget = this.createLegacyLiveTarget(target, options);
            return this.streams.getLegacyStream(legacyTarget);
          })
        )
      ),
      map(data => ({
        data,
        key: `loki-${liveTarget.refId}`,
        state: LoadingState.Streaming,
      }))
    );
  };

  interpolateVariablesInQueries(queries: LokiQuery[], scopedVars: ScopedVars): LokiQuery[] {
    let expandedQueries = queries;
    if (queries && queries.length) {
      expandedQueries = queries.map(query => ({
        ...query,
        datasource: this.name,
        expr: this.templateSrv.replace(query.expr, scopedVars, this.interpolateQueryExpr),
      }));
    }

    return expandedQueries;
  }

  async importQueries(queries: LokiQuery[], originMeta: PluginMeta): Promise<LokiQuery[]> {
    return this.languageProvider.importQueries(queries, originMeta.id);
  }

  async metadataRequest(url: string, params?: Record<string, string>) {
    const res = await this._request(url, params, { silent: true }).toPromise();
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
      return await this.labelValuesQuery(labelValues[2]);
    }

    return Promise.resolve([]);
  }

  async labelNamesQuery() {
    const url = (await this.getVersion()) === 'v0' ? `${LEGACY_LOKI_ENDPOINT}/label` : `${LOKI_ENDPOINT}/label`;
    const result = await this.metadataRequest(url);
    return result.map((value: string) => ({ text: value }));
  }

  async labelValuesQuery(label: string) {
    const url =
      (await this.getVersion()) === 'v0'
        ? `${LEGACY_LOKI_ENDPOINT}/label/${label}/values`
        : `${LOKI_ENDPOINT}/label/${label}/values`;
    const result = await this.metadataRequest(url);
    return result.map((value: string) => ({ text: value }));
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
    const parsed = parseQuery(query.expr || '');
    let { query: selector } = parsed;
    let selectorLabels, selectorFilters;
    switch (action.type) {
      case 'ADD_FILTER': {
        selectorLabels = addLabelToSelector(selector, action.key, action.value);
        selectorFilters = keepSelectorFilters(selector);
        selector = `${selectorLabels} ${selectorFilters}`.trim();
        break;
      }
      case 'ADD_FILTER_OUT': {
        selectorLabels = addLabelToSelector(selector, action.key, action.value, '!=');
        selectorFilters = keepSelectorFilters(selector);
        selector = `${selectorLabels} ${selectorFilters}`.trim();
        break;
      }
      default:
        break;
    }

    const expression = formatQuery(selector, parsed.regexp);
    return { ...query, expr: expression };
  }

  getHighlighterExpression(query: LokiQuery): string[] {
    return getHighlighterExpressionsFromQuery(query.expr);
  }

  getTime(date: string | DateTime, roundUp: boolean) {
    if (typeof date === 'string') {
      date = dateMath.parse(date, roundUp);
    }

    return Math.ceil(date.valueOf() * 1e6);
  }

  getLogRowContext = (row: LogRowModel, options?: LokiContextQueryOptions): Promise<{ data: DataFrame[] }> => {
    const target = this.prepareLogRowContextQueryTarget(
      row,
      (options && options.limit) || 10,
      (options && options.direction) || 'BACKWARD'
    );

    const reverse = options && options.direction === 'FORWARD';
    return this._request(RANGE_QUERY_ENDPOINT, target)
      .pipe(
        catchError((err: any) => {
          if (err.status === 404) {
            return of(err);
          }

          const error: DataQueryError = {
            message: 'Error during context query. Please check JS console logs.',
            status: err.status,
            statusText: err.statusText,
          };
          throw error;
        }),
        switchMap((res: { data: LokiStreamResponse; status: number }) =>
          iif(
            () => res.status === 404,
            defer(() =>
              this._request(LEGACY_QUERY_ENDPOINT, target).pipe(
                catchError((err: any) => {
                  const error: DataQueryError = {
                    message: 'Error during context query. Please check JS console logs.',
                    status: err.status,
                    statusText: err.statusText,
                  };
                  throw error;
                }),
                map((res: { data: LokiLegacyStreamResponse }) => ({
                  data: res.data ? res.data.streams.map(stream => legacyLogStreamToDataFrame(stream, reverse)) : [],
                }))
              )
            ),
            defer(() =>
              of({
                data: res.data ? res.data.data.result.map(stream => lokiStreamResultToDataFrame(stream, reverse)) : [],
              })
            )
          )
        )
      )
      .toPromise();
  };

  prepareLogRowContextQueryTarget = (row: LogRowModel, limit: number, direction: 'BACKWARD' | 'FORWARD') => {
    const query = Object.keys(row.labels)
      .map(label => `${label}="${row.labels[label]}"`)
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
    return this._request('/loki/api/v1/label', { start })
      .pipe(
        catchError((err: any) => {
          if (err.status === 404) {
            return of(err);
          }

          throw err;
        }),
        switchMap((response: { data: { values: string[] }; status: number }) =>
          iif<DataQueryResponse, any>(
            () => response.status === 404,
            defer(() => this._request('/api/prom/label', { start })),
            defer(() => of(response))
          )
        ),
        map(res => {
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
      .toPromise();
  }

  async annotationQuery(options: AnnotationQueryRequest<LokiQuery>): Promise<AnnotationEvent[]> {
    if (!options.annotation.expr) {
      return [];
    }

    const interpolatedExpr = this.templateSrv.replace(options.annotation.expr, {}, this.interpolateQueryExpr);
    const query = { refId: `annotation-${options.annotation.name}`, expr: interpolatedExpr };
    const { data } = await this.runRangeQueryWithFallback(query, options).toPromise();
    const annotations: AnnotationEvent[] = [];

    for (const frame of data) {
      const tags: string[] = [];
      for (const field of frame.fields) {
        if (field.labels) {
          tags.push.apply(tags, Object.values(field.labels));
        }
      }
      const view = new DataFrameView<{ ts: string; line: string }>(frame);

      view.forEachRow(row => {
        annotations.push({
          time: new Date(row.ts).valueOf(),
          text: row.line,
          tags,
        });
      });
    }

    return annotations;
  }

  throwUnless = (err: any, condition: boolean, target: LokiQuery) => {
    if (condition) {
      return of(err);
    }

    const error: DataQueryError = this.processError(err, target);
    throw error;
  };

  processError = (err: any, target: LokiQuery): DataQueryError => {
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

  adjustInterval(interval: number, range: number) {
    // Loki will drop queries that might return more than 11000 data points.
    // Calibrate interval if it is too small.
    if (interval !== 0 && range / interval > 11000) {
      interval = Math.ceil(range / 11000);
    }
    return Math.max(interval, 1000);
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

export default LokiDatasource;

function isTimeSeries(data: any): data is TimeSeries {
  return data.hasOwnProperty('datapoints');
}
