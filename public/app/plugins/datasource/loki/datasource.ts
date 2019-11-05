// Libraries
import { isEmpty, map as lodashMap, fromPairs } from 'lodash';
import { Observable, from, merge, of, iif, defer } from 'rxjs';
import { map, filter, catchError, switchMap } from 'rxjs/operators';

// Services & Utils
import {
  dateMath,
  LogRowModel,
  DateTime,
  LoadingState,
  DataFrame,
  AnnotationEvent,
  DataFrameView,
  TimeSeries,
  TimeRange,
  FieldConfig,
  ArrayVector,
  FieldType,
} from '@grafana/data';
import { addLabelToSelector } from 'app/plugins/datasource/prometheus/add_label_to_query';
import LanguageProvider from './language_provider';
import {
  legacyLogStreamToDataFrame,
  rangeQueryResponseToTimeSeries,
  lokiResultsToTableModel,
  lokiStreamResultToDataFrame,
} from './result_transformer';
import { formatQuery, parseQuery, getHighlighterExpressionsFromQuery } from './query_utils';
import { BackendSrv, DatasourceRequestOptions } from 'app/core/services/backend_srv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { safeStringifyValue, convertToWebSocketUrl } from 'app/core/utils/explore';

// Types
import {
  PluginMeta,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataQueryError,
  DataQueryRequest,
  DataQueryResponse,
  AnnotationQueryRequest,
} from '@grafana/data';

import {
  LokiQuery,
  LokiOptions,
  LokiLegacyStreamResult,
  LokiLegacyQueryRequest,
  LokiLegacyStreamResponse,
  LokiResponse,
  TransformerOptions,
  LokiResultType,
  LokiQueryRangeRequest as LokiRangeQueryRequest,
  LokiStreamResult,
} from './types';
import { ExploreMode } from 'app/types';
import { LiveTarget, LiveStreams } from './live_streams';

export const DEFAULT_MAX_LINES = 1000;

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
  languageProvider: LanguageProvider;
  maxLines: number;

  /** @ngInject */
  constructor(
    private instanceSettings: DataSourceInstanceSettings<LokiOptions>,
    private backendSrv: BackendSrv,
    private templateSrv: TemplateSrv
  ) {
    super(instanceSettings);
    this.languageProvider = new LanguageProvider(this);
    const settingsData = instanceSettings.jsonData || {};
    this.maxLines = parseInt(settingsData.maxLines, 10) || DEFAULT_MAX_LINES;
  }

  _request(apiUrl: string, data?: any, options?: DatasourceRequestOptions): Promise<{ [key: string]: any }> {
    const baseUrl = this.instanceSettings.url;
    const params = data ? serializeParams(data) : '';
    const url = `${baseUrl}${apiUrl}${params.length ? `?${params}` : ''}`;
    const req = {
      ...options,
      url,
    };

    return this.backendSrv.datasourceRequest(req);
  }

  query(options: DataQueryRequest<LokiQuery>): Observable<DataQueryResponse> {
    const subQueries: Array<Observable<DataQueryResponse>> = [];
    const filteredTargets = options.targets.filter(target => target.expr && !target.hide);

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
              if (
                options.exploreMode === ExploreMode.Logs &&
                dataQueryResponse.data.find(d => d.hasOwnProperty('datapoints'))
              ) {
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
    options: { range: TimeRange; maxDataPoints?: number }
  ): Observable<DataQueryResponse> => {
    if (target.liveStreaming) {
      return this.runLiveQuery(target, options);
    }

    const interpolatedExpr = this.templateSrv.replace(target.expr);
    const query: LokiLegacyQueryRequest = {
      ...DEFAULT_QUERY_PARAMS,
      ...parseQuery(interpolatedExpr),
      start: this.getTime(options.range.from, false),
      end: this.getTime(options.range.to, true),
      limit: Math.min(options.maxDataPoints || Infinity, this.maxLines),
      refId: target.refId,
    };

    return from(
      this._request('/api/prom/query', query).catch((err: any) => {
        if (err.cancelled) {
          return err;
        }

        const error: DataQueryError = this.processError(err, target);
        throw error;
      })
    ).pipe(
      filter((response: any) => (response.cancelled ? false : true)),
      map((response: { data: LokiLegacyStreamResponse }) => {
        const data = this.lokiLegacyStreamsToDataframes(response.data, query);
        return { data, key: `${target.refId}_log` };
      })
    );
  };

  lokiStreamsToDataframes = (
    data: LokiStreamResult[],
    target: { refId: string; query?: string; regexp?: string }
  ): DataFrame[] => {
    const series: DataFrame[] = data.map(stream => ({
      ...lokiStreamResultToDataFrame(stream),
      refId: target.refId,
      meta: {
        searchWords: getHighlighterExpressionsFromQuery(formatQuery(target.query, target.regexp)),
        limit: this.maxLines,
      },
    }));

    return series;
  };

  lokiLegacyStreamsToDataframes = (
    data: LokiLegacyStreamResult | LokiLegacyStreamResponse,
    target: { refId: string; query?: string; regexp?: string }
  ): DataFrame[] => {
    if (Object.keys(data).length === 0) {
      return [];
    }

    if (isLokiLogsStream(data)) {
      return [legacyLogStreamToDataFrame(data, false, target.refId)];
    }

    const series: DataFrame[] = data.streams.map(stream => {
      const dataFrame = legacyLogStreamToDataFrame(stream);
      this.enhanceDataFrame(dataFrame);

      return {
        ...dataFrame,
        refId: target.refId,
        meta: {
          searchWords: getHighlighterExpressionsFromQuery(formatQuery(target.query, target.regexp)),
          limit: this.maxLines,
        },
      };
    });

    return series;
  };

  runInstantQuery = (
    target: LokiQuery,
    options: DataQueryRequest<LokiQuery>,
    responseListLength: number
  ): Observable<DataQueryResponse> => {
    const interpolatedExpr = this.templateSrv.replace(target.expr);
    const timeNs = this.getTime(options.range.to, true);
    const query = {
      query: parseQuery(interpolatedExpr).query,
      time: `${timeNs + (1e9 - (timeNs % 1e9))}`,
      limit: Math.min(options.maxDataPoints || Infinity, this.maxLines),
    };

    return from(
      this._request('/loki/api/v1/query', query).catch((err: any) => {
        if (err.cancelled) {
          return err;
        }

        const error = this.processError(err, target);
        throw error;
      })
    ).pipe(
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

  adjustInterval(interval: number, range: number) {
    // Loki will drop queries that might return more than 11000 data points.
    // Calibrate interval if it is too small.
    if (interval !== 0 && range / interval > 11000) {
      interval = Math.ceil(range / 11000);
    }
    return Math.max(interval, 1000);
  }

  createRangeQuery(target: LokiQuery, options: DataQueryRequest<LokiQuery>): LokiRangeQueryRequest {
    const interpolatedExpr = this.templateSrv.replace(target.expr, {}, this.interpolateQueryExpr);
    const { query } = parseQuery(interpolatedExpr);
    const startNs = this.getTime(options.range.from, false);
    const endNs = this.getTime(options.range.to, true);
    const rangeMs = Math.ceil((endNs - startNs) / 1e6);
    const step = this.adjustInterval(options.intervalMs, rangeMs) / 1000;
    const alignedTimes = {
      start: startNs - (startNs % 1e9),
      end: endNs + (1e9 - (endNs % 1e9)),
    };

    return {
      ...DEFAULT_QUERY_PARAMS,
      query,
      start: alignedTimes.start,
      end: alignedTimes.end,
      step,
      limit: Math.min(options.maxDataPoints || Infinity, this.maxLines),
    };
  }

  /**
   * Attempts to send a query to /loki/api/v1/query_range but falls back to the legacy endpoint if necessary.
   */
  runRangeQueryWithFallback = (
    target: LokiQuery,
    options: DataQueryRequest<LokiQuery>,
    responseListLength: number
  ): Observable<DataQueryResponse> => {
    const query = this.createRangeQuery(target, options);

    return from(this._request('/loki/api/v1/query_range', query)).pipe(
      catchError((err: any) => {
        if (err.cancelled || err.status === 404) {
          return of(err);
        }

        const error: DataQueryError = this.processError(err, target);
        throw error;
      }),
      filter((response: any) => (response.cancelled ? false : true)),
      switchMap((response: { data: LokiResponse; status: number }) =>
        iif<DataQueryResponse, DataQueryResponse>(
          () => response.status === 404,
          defer(() => this.runLegacyQuery(target, options)),
          defer(() => this.processRangeQueryResponse(response.data, target, query, responseListLength))
        )
      )
    );
  };

  processRangeQueryResponse = (
    response: LokiResponse,
    target: LokiQuery,
    query: LokiRangeQueryRequest,
    responseListLength: number
  ) => {
    switch (response.data.resultType) {
      case LokiResultType.Stream:
        const data = this.lokiStreamsToDataframes(response.data.result, target);
        return of({ data, key: `${target.refId}_log` });

      case LokiResultType.Vector:
      case LokiResultType.Matrix:
        return of({
          data: this.rangeQueryResponseToTimeSeries(
            response,
            query,
            {
              ...target,
              format: 'time_series',
            },
            responseListLength
          ),
          key: target.refId,
        });
      default:
        throw new Error(`Unknown result type "${(response.data as any).resultType}".`);
    }
  };

  rangeQueryResponseToTimeSeries = (
    response: LokiResponse,
    query: LokiRangeQueryRequest,
    target: LokiQuery,
    responseListLength: number
  ): TimeSeries[] => {
    const transformerOptions: TransformerOptions = {
      format: target.format,
      legendFormat: target.legendFormat,
      start: query.start,
      end: query.end,
      step: query.step,
      query: query.query,
      responseListLength,
      refId: target.refId,
      valueWithRefId: target.valueWithRefId,
    };

    return rangeQueryResponseToTimeSeries(response, transformerOptions);
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

  createLiveTarget(target: LokiQuery, options: { maxDataPoints?: number }): LiveTarget {
    const interpolated = this.templateSrv.replace(target.expr, {}, this.interpolateQueryExpr);
    const { query, regexp } = parseQuery(interpolated);
    const baseUrl = this.instanceSettings.url;
    const params = serializeParams({ query, regexp });

    return {
      query,
      regexp,
      url: convertToWebSocketUrl(`${baseUrl}/api/prom/tail?${params}`),
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
    const stream = this.streams.getStream(liveTarget);
    return stream.pipe(
      map(data => ({
        data,
        key: `loki-${liveTarget.refId}`,
        state: LoadingState.Streaming,
      }))
    );
  };

  interpolateVariablesInQueries(queries: LokiQuery[]): LokiQuery[] {
    let expandedQueries = queries;
    if (queries && queries.length) {
      expandedQueries = queries.map(query => ({
        ...query,
        datasource: this.name,
        expr: this.templateSrv.replace(query.expr, {}, this.interpolateQueryExpr),
      }));
    }

    return expandedQueries;
  }

  async importQueries(queries: LokiQuery[], originMeta: PluginMeta): Promise<LokiQuery[]> {
    return this.languageProvider.importQueries(queries, originMeta.id);
  }

  async metadataRequest(url: string, params?: { [key: string]: string }) {
    // HACK to get label values for {job=|}, will be replaced when implementing LokiQueryField
    const apiUrl = url.replace('v1', 'prom');
    const res = await this._request(apiUrl, params, { silent: true });
    return {
      data: { data: res.data.values || [] },
    };
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
    switch (action.type) {
      case 'ADD_FILTER': {
        selector = addLabelToSelector(selector, action.key, action.value);
        break;
      }
      case 'ADD_FILTER_OUT': {
        selector = addLabelToSelector(selector, action.key, action.value, '!=');
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

  getLogRowContext = async (row: LogRowModel, options?: LokiContextQueryOptions) => {
    const target = this.prepareLogRowContextQueryTarget(
      row,
      (options && options.limit) || 10,
      (options && options.direction) || 'BACKWARD'
    );

    try {
      const reverse = options && options.direction === 'FORWARD';
      const result = await this._request('/api/prom/query', target);

      return {
        data: result.data ? result.data.streams.map((stream: any) => legacyLogStreamToDataFrame(stream, reverse)) : [],
      };
    } catch (e) {
      const error: DataQueryError = {
        message: 'Error during context query. Please check JS console logs.',
        status: e.status,
        statusText: e.statusText,
      };
      throw error;
    }
  };

  getVersion() {
    return this._request('/loki/api/v1/query_range')
      .then(() => 'v1')
      .catch(err => (err.status !== 404 ? 'v1' : 'v0'));
  }

  prepareLogRowContextQueryTarget = (row: LogRowModel, limit: number, direction: 'BACKWARD' | 'FORWARD') => {
    const query = Object.keys(row.labels)
      .map(label => `${label}="${row.labels[label]}"`)
      .join(',');

    const contextTimeBuffer = 2 * 60 * 60 * 1000 * 1e6; // 2h buffer
    const timeEpochNs = row.timeEpochMs * 1e6;
    const commonTargetOptions = {
      limit,
      query: `{${query}}`,
      direction,
    };

    if (direction === 'BACKWARD') {
      return {
        ...commonTargetOptions,
        start: timeEpochNs - contextTimeBuffer,
        end: row.timestamp, // using RFC3339Nano format to avoid precision loss
        direction,
      };
    } else {
      return {
        ...commonTargetOptions,
        start: row.timestamp, // start param in Loki API is inclusive so we'll have to filter out the row that this request is based from
        end: timeEpochNs + contextTimeBuffer,
      };
    }
  };

  testDatasource() {
    // Consider only last 10 minutes otherwise request takes too long
    const startMs = Date.now() - 10 * 60 * 1000;
    const start = `${startMs}000000`; // API expects nanoseconds
    return this._request('/api/prom/label', { start })
      .then((res: DataQueryResponse) => {
        return res && res.data && res.data.values && res.data.values.length
          ? { status: 'success', message: 'Data source connected and labels found.' }
          : {
              status: 'error',
              message:
                'Data source connected, but no labels received. Verify that Loki and Promtail is configured properly.',
            };
      })
      .catch((err: any) => {
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
        return { status: 'error', message: message };
      });
  }

  async annotationQuery(options: AnnotationQueryRequest<LokiQuery>): Promise<AnnotationEvent[]> {
    if (!options.annotation.expr) {
      return [];
    }

    const query = { refId: `annotation-${options.annotation.name}`, expr: options.annotation.expr };
    const { data } = await this.runLegacyQuery(query, options).toPromise();
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

  /**
   * Adds new fields and DataLinks to DataFrame based on DataSource instance config.
   * @param dataFrame
   */
  enhanceDataFrame(dataFrame: DataFrame): void {
    if (!this.instanceSettings.jsonData) {
      return;
    }

    const derivedFields = this.instanceSettings.jsonData.derivedFields || [];
    if (derivedFields.length) {
      const fields = fromPairs(
        derivedFields.map(field => {
          const config: FieldConfig = {};
          if (field.url) {
            config.links = [
              {
                url: field.url,
                title: '',
              },
            ];
          }
          const dataFrameField = {
            name: field.name,
            type: FieldType.string,
            config,
            values: new ArrayVector<string>([]),
          };

          return [field.name, dataFrameField];
        })
      );

      const view = new DataFrameView(dataFrame);
      view.forEachRow((row: { line: string }) => {
        for (const field of derivedFields) {
          const logMatch = row.line.match(field.matcherRegex);
          fields[field.name].values.add(logMatch && logMatch[1]);
        }
      });

      dataFrame.fields = [...dataFrame.fields, ...Object.values(fields)];
    }
  }
}

function isLokiLogsStream(data: LokiLegacyStreamResult | LokiLegacyStreamResponse): data is LokiLegacyStreamResult {
  return !data.hasOwnProperty('streams');
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
