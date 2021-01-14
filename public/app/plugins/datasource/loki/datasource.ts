// Libraries
import { cloneDeep, isEmpty, map as lodashMap } from 'lodash';
import { merge, Observable, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import Prism from 'prismjs';

// Types
import {
  AnnotationEvent,
  AnnotationQueryRequest,
  DataFrame,
  DataFrameView,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  DataSourceApi,
  DataSourceInstanceSettings,
  dateMath,
  DateTime,
  FieldCache,
  LoadingState,
  LogRowModel,
  PluginMeta,
  QueryResultMeta,
  ScopedVars,
  TimeRange,
} from '@grafana/data';
import { getTemplateSrv, TemplateSrv, BackendSrvRequest, FetchError, getBackendSrv } from '@grafana/runtime';
import { addLabelToQuery } from 'app/plugins/datasource/prometheus/add_label_to_query';
import { getTimeSrv, TimeSrv } from 'app/features/dashboard/services/TimeSrv';
import { convertToWebSocketUrl } from 'app/core/utils/explore';
import {
  lokiResultsToTableModel,
  lokiStreamResultToDataFrame,
  lokiStreamsToDataFrames,
  processRangeQueryResponse,
} from './result_transformer';
import { getHighlighterExpressionsFromQuery } from './query_utils';

import {
  LokiOptions,
  LokiQuery,
  LokiRangeQueryRequest,
  LokiResponse,
  LokiResultType,
  LokiStreamResponse,
} from './types';
import { LiveStreams, LokiLiveTarget } from './live_streams';
import LanguageProvider, { rangeToParams } from './language_provider';
import { serializeParams } from '../../../core/utils/fetch';
import { RowContextOptions } from '@grafana/ui/src/components/Logs/LogRowContextProvider';
import syntax from './syntax';

export type RangeQueryOptions = DataQueryRequest<LokiQuery> | AnnotationQueryRequest<LokiQuery>;
export const DEFAULT_MAX_LINES = 1000;
export const LOKI_ENDPOINT = '/loki/api/v1';

const RANGE_QUERY_ENDPOINT = `${LOKI_ENDPOINT}/query_range`;
const INSTANT_QUERY_ENDPOINT = `${LOKI_ENDPOINT}/query`;

const DEFAULT_QUERY_PARAMS: Partial<LokiRangeQueryRequest> = {
  direction: 'BACKWARD',
  limit: DEFAULT_MAX_LINES,
  query: '',
};

export class LokiDatasource extends DataSourceApi<LokiQuery, LokiOptions> {
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
    const req = {
      ...options,
      url,
    };

    return getBackendSrv().fetch<Record<string, any>>(req);
  }

  query(options: DataQueryRequest<LokiQuery>): Observable<DataQueryResponse> {
    const subQueries: Array<Observable<DataQueryResponse>> = [];
    const filteredTargets = options.targets
      .filter(target => target.expr && !target.hide)
      .map(target => ({
        ...target,
        expr: this.templateSrv.replace(target.expr, options.scopedVars, this.interpolateQueryExpr),
      }));

    for (const target of filteredTargets) {
      if (target.instant) {
        subQueries.push(this.runInstantQuery(target, options, filteredTargets.length));
      } else {
        subQueries.push(this.runRangeQuery(target, options, filteredTargets.length));
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
    responseListLength: number
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
      map((response: { data: LokiResponse }) => {
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
      catchError((err: any) => this.throwUnless(err, err.status === 404, target))
    );
  };

  createRangeQuery(target: LokiQuery, options: RangeQueryOptions, limit: number): LokiRangeQueryRequest {
    const query = target.expr;
    let range: { start?: number; end?: number; step?: number } = {};
    if (options.range) {
      const startNs = this.getTime(options.range.from, false);
      const endNs = this.getTime(options.range.to, true);
      const rangeMs = Math.ceil((endNs - startNs) / 1e6);
      const step = Math.ceil(
        this.adjustInterval((options as DataQueryRequest<LokiQuery>).intervalMs || 1000, rangeMs) / 1000
      );
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
    return this._request(RANGE_QUERY_ENDPOINT, query).pipe(
      catchError((err: any) => this.throwUnless(err, err.status === 404, target)),
      switchMap((response: { data: LokiResponse; status: number }) =>
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
      map(data => ({
        data: data || [],
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

  getQueryDisplayText(query: LokiQuery) {
    return query.expr;
  }

  async importQueries(queries: LokiQuery[], originMeta: PluginMeta): Promise<LokiQuery[]> {
    return this.languageProvider.importQueries(queries, originMeta.id);
  }

  async metadataRequest(url: string, params?: Record<string, string | number>) {
    const res = await this._request(url, params, { hideFromInspector: true }).toPromise();
    return res.data.data || res.data.values || [];
  }

  async metricFindQuery(query: string, optionalOptions?: any) {
    if (!query) {
      return Promise.resolve([]);
    }
    const interpolated = this.templateSrv.replace(query, {}, this.interpolateQueryExpr);
    return await this.processMetricFindQuery(interpolated, optionalOptions?.range);
  }

  async processMetricFindQuery(query: string, range?: TimeRange) {
    const labelNamesRegex = /^label_names\(\)\s*$/;
    const labelValuesRegex = /^label_values\((?:(.+),\s*)?([a-zA-Z_][a-zA-Z0-9_]*)\)\s*$/;

    const timeRange = range || this.timeSrv.timeRange();
    const params = rangeToParams({ from: timeRange.from.valueOf(), to: timeRange.to.valueOf() });

    const labelNames = query.match(labelNamesRegex);
    if (labelNames) {
      return await this.labelNamesQuery(params);
    }

    const labelValues = query.match(labelValuesRegex);
    if (labelValues) {
      return await this.labelValuesQuery(labelValues[2], params);
    }

    return Promise.resolve([]);
  }

  async labelNamesQuery(params?: Record<string, string | number>) {
    const url = `${LOKI_ENDPOINT}/label`;
    const result = await this.metadataRequest(url, params);
    return result.map((value: string) => ({ text: value }));
  }

  async labelValuesQuery(label: string, params?: Record<string, string | number>) {
    const url = `${LOKI_ENDPOINT}/label/${label}/values`;
    const result = await this.metadataRequest(url, params);
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
    let expression = query.expr ?? '';
    switch (action.type) {
      case 'ADD_FILTER': {
        expression = addLabelToQuery(expression, action.key, action.value, undefined, true);
        break;
      }
      case 'ADD_FILTER_OUT': {
        expression = addLabelToQuery(expression, action.key, action.value, '!=', true);
        break;
      }
      default:
        break;
    }
    return { ...query, expr: expression };
  }

  getHighlighterExpression(query: LokiQuery): string[] {
    return getHighlighterExpressionsFromQuery(query.expr);
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
          of({
            data: res.data ? res.data.data.result.map(stream => lokiStreamResultToDataFrame(stream, reverse)) : [],
          })
        )
      )
      .toPromise();
  };

  prepareLogRowContextQueryTarget = (row: LogRowModel, limit: number, direction: 'BACKWARD' | 'FORWARD') => {
    const query = Object.keys(row.labels)
      .map(label => `${label}="${row.labels[label].replace(/\\/g, '\\\\')}"`) // escape backslashes in label as users can't escape them by themselves
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
    return this._request(`${LOKI_ENDPOINT}/label`, { start })
      .pipe(
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
    const { data } = await this.runRangeQuery(query, options as any).toPromise();
    const annotations: AnnotationEvent[] = [];

    for (const frame of data) {
      const tags: string[] = [];
      for (const field of frame.fields) {
        if (field.labels) {
          tags.push.apply(tags, [...new Set(Object.values(field.labels).map((label: string) => label.trim()))]);
        }
      }
      const view = new DataFrameView<{ ts: string; line: string }>(frame);

      view.forEach(row => {
        annotations.push({
          time: new Date(row.ts).valueOf(),
          text: row.line,
          tags,
        });
      });
    }

    return annotations;
  }

  showContextToggle(row?: LogRowModel): boolean {
    return (row && row.searchWords && row.searchWords.length > 0) === true;
  }

  throwUnless(err: FetchError, condition: boolean, target: LokiQuery) {
    if (condition) {
      return of(err);
    }

    const error = this.processError(err, target);
    throw error;
  }

  processError(err: FetchError, target: LokiQuery) {
    let error = cloneDeep(err);
    if (err.data.message.includes('escape') && target.expr.includes('\\')) {
      error.data.message = `Error: ${err.data.message}. Make sure that all special characters are escaped with \\. For more information on escaping of special characters visit LogQL documentation at https://grafana.com/docs/loki/latest/logql/.`;
    }
    return error;
  }

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

/**
 * Checks if the query expression uses function and so should return a time series instead of logs.
 * Sometimes important to know that before we actually do the query.
 */
function isMetricsQuery(query: string): boolean {
  const tokens = Prism.tokenize(query, syntax);
  return tokens.some(t => {
    // Not sure in which cases it can be string maybe if nothing matched which means it should not be a function
    return typeof t !== 'string' && t.type === 'function';
  });
}

export default LokiDatasource;
