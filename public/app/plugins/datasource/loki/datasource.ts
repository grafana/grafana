// Libraries
import { isEmpty, isString, fromPairs, map as lodashMap } from 'lodash';
// Services & Utils
import {
  dateMath,
  DataFrame,
  LogRowModel,
  DateTime,
  AnnotationEvent,
  DataFrameView,
  LoadingState,
  ArrayVector,
  FieldType,
  FieldConfig,
} from '@grafana/data';
import { addLabelToSelector, keepSelectorFilters } from 'app/plugins/datasource/prometheus/add_label_to_query';
import LanguageProvider from './language_provider';
import { logStreamToDataFrame } from './result_transformer';
import { formatQuery, parseQuery, getHighlighterExpressionsFromQuery } from './query_utils';
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
import { LokiQuery, LokiOptions, LokiLogsStream, LokiResponse } from './types';
import { BackendSrv } from 'app/core/services/backend_srv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { safeStringifyValue, convertToWebSocketUrl } from 'app/core/utils/explore';
import { LiveTarget, LiveStreams } from './live_streams';
import { Observable, from, merge, of } from 'rxjs';
import { map, filter } from 'rxjs/operators';

export const DEFAULT_MAX_LINES = 1000;

const DEFAULT_QUERY_PARAMS = {
  direction: 'BACKWARD',
  limit: DEFAULT_MAX_LINES,
  regexp: '',
  query: '',
};

function serializeParams(data: any) {
  return Object.keys(data)
    .map(k => {
      const v = data[k];
      return encodeURIComponent(k) + '=' + encodeURIComponent(v);
    })
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

  _request(apiUrl: string, data?: any, options?: any) {
    const baseUrl = this.instanceSettings.url;
    const params = data ? serializeParams(data) : '';
    const url = `${baseUrl}${apiUrl}?${params}`;
    const req = {
      ...options,
      url,
    };

    return this.backendSrv.datasourceRequest(req);
  }

  prepareLiveTarget(target: LokiQuery, options: DataQueryRequest<LokiQuery>): LiveTarget {
    const interpolated = this.templateSrv.replace(target.expr, {}, this.interpolateQueryExpr);
    const { query, regexp } = parseQuery(interpolated);
    const refId = target.refId;
    const baseUrl = this.instanceSettings.url;
    const params = serializeParams({ query, regexp });
    const url = convertToWebSocketUrl(`${baseUrl}/api/prom/tail?${params}`);

    return {
      query,
      regexp,
      url,
      refId,
      size: Math.min(options.maxDataPoints || Infinity, this.maxLines),
    };
  }

  prepareQueryTarget(target: LokiQuery, options: DataQueryRequest<LokiQuery>) {
    const interpolated = this.templateSrv.replace(target.expr, {}, this.interpolateQueryExpr);
    const { query, regexp } = parseQuery(interpolated);
    const start = this.getTime(options.range.from, false);
    const end = this.getTime(options.range.to, true);
    const refId = target.refId;
    return {
      ...DEFAULT_QUERY_PARAMS,
      query,
      regexp,
      start,
      end,
      limit: Math.min(options.maxDataPoints || Infinity, this.maxLines),
      refId,
    };
  }

  processError = (err: any, target: any): DataQueryError => {
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

  processResult = (data: LokiLogsStream | LokiResponse, target: any): DataFrame[] => {
    const series: DataFrame[] = [];

    if (Object.keys(data).length === 0) {
      return series;
    }

    if (!(data as any).streams) {
      return [logStreamToDataFrame(data as LokiLogsStream, false, target.refId)];
    }

    data = data as LokiResponse;
    for (const stream of data.streams || []) {
      const dataFrame = logStreamToDataFrame(stream);
      this.enhanceDataFrame(dataFrame);
      dataFrame.refId = target.refId;
      dataFrame.meta = {
        searchWords: getHighlighterExpressionsFromQuery(formatQuery(target.query, target.regexp)),
        limit: this.maxLines,
      };
      series.push(dataFrame);
    }

    return series;
  };

  /**
   * Runs live queries which in this case means creating a websocket and listening on it for new logs.
   * This returns a bit different dataFrame than runQueries as it returns single dataframe even if there are multiple
   * Loki streams, sets only common labels on dataframe.labels and has additional dataframe.fields.labels for unique
   * labels per row.
   */
  runLiveQuery = (options: DataQueryRequest<LokiQuery>, target: LokiQuery): Observable<DataQueryResponse> => {
    const liveTarget = this.prepareLiveTarget(target, options);
    const stream = this.streams.getStream(liveTarget);
    return stream.pipe(
      map(data => {
        return {
          data,
          key: `loki-${liveTarget.refId}`,
          state: LoadingState.Streaming,
        };
      })
    );
  };

  runQuery = (options: DataQueryRequest<LokiQuery>, target: LokiQuery): Observable<DataQueryResponse> => {
    const query = this.prepareQueryTarget(target, options);
    return from(
      this._request('/api/prom/query', query).catch((err: any) => {
        if (err.cancelled) {
          return err;
        }

        const error: DataQueryError = this.processError(err, query);
        throw error;
      })
    ).pipe(
      filter((response: any) => (response.cancelled ? false : true)),
      map((response: any) => {
        const data = this.processResult(response.data, query);
        return { data, key: query.refId };
      })
    );
  };

  query(options: DataQueryRequest<LokiQuery>): Observable<DataQueryResponse> {
    const subQueries = options.targets
      .filter(target => target.expr && !target.hide)
      .map(target => {
        if (target.liveStreaming) {
          return this.runLiveQuery(options, target);
        }
        return this.runQuery(options, target);
      });

    // No valid targets, return the empty result to save a round trip.
    if (isEmpty(subQueries)) {
      return of({
        data: [],
        state: LoadingState.Done,
      });
    }

    return merge(...subQueries);
  }

  interpolateVariablesInQueries(queries: LokiQuery[]): LokiQuery[] {
    let expandedQueries = queries;
    if (queries && queries.length > 0) {
      expandedQueries = queries.map(query => {
        const expandedQuery = {
          ...query,
          datasource: this.name,
          expr: this.templateSrv.replace(query.expr, {}, this.interpolateQueryExpr),
        };
        return expandedQuery;
      });
    }
    return expandedQueries;
  }

  async importQueries(queries: LokiQuery[], originMeta: PluginMeta): Promise<LokiQuery[]> {
    return this.languageProvider.importQueries(queries, originMeta.id);
  }

  metadataRequest(url: string, params?: any) {
    // HACK to get label values for {job=|}, will be replaced when implementing LokiQueryField
    const apiUrl = url.replace('v1', 'prom');
    return this._request(apiUrl, params, { silent: true }).then((res: DataQueryResponse) => {
      const data: any = { data: { data: res.data.values || [] } };
      return data;
    });
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
        selector = `${selectorLabels} ${selectorFilters}`;
        break;
      }
      case 'ADD_FILTER_OUT': {
        selectorLabels = addLabelToSelector(selector, action.key, action.value, '!=');
        selectorFilters = keepSelectorFilters(selector);
        selector = `${selectorLabels} ${selectorFilters}`;
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
    if (isString(date)) {
      date = dateMath.parse(date, roundUp);
    }
    return Math.ceil(date.valueOf() * 1e6);
  }

  prepareLogRowContextQueryTarget = (row: LogRowModel, limit: number, direction: 'BACKWARD' | 'FORWARD') => {
    const query = Object.keys(row.labels)
      .map(label => {
        return `${label}="${row.labels[label]}"`;
      })
      .join(',');
    const contextTimeBuffer = 2 * 60 * 60 * 1000 * 1e6; // 2h buffer
    const timeEpochNs = row.timeEpochMs * 1e6;

    const commontTargetOptons = {
      limit,
      query: `{${query}}`,
      direction,
    };

    if (direction === 'BACKWARD') {
      return {
        ...commontTargetOptons,
        start: timeEpochNs - contextTimeBuffer,
        end: row.timestamp, // using RFC3339Nano format to avoid precision loss
        direction,
      };
    } else {
      return {
        ...commontTargetOptons,
        start: row.timestamp, // start param in Loki API is inclusive so we'll have to filter out the row that this request is based from
        end: timeEpochNs + contextTimeBuffer,
      };
    }
  };

  getLogRowContext = async (row: LogRowModel, options?: LokiContextQueryOptions) => {
    const target = this.prepareLogRowContextQueryTarget(
      row,
      (options && options.limit) || 10,
      (options && options.direction) || 'BACKWARD'
    );
    const series: DataFrame[] = [];

    try {
      const reverse = options && options.direction === 'FORWARD';
      const result = await this._request('/api/prom/query', target);
      if (result.data) {
        for (const stream of result.data.streams || []) {
          series.push(logStreamToDataFrame(stream, reverse));
        }
      }

      return {
        data: series,
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

  testDatasource() {
    // Consider only last 10 minutes otherwise request takes too long
    const startMs = Date.now() - 10 * 60 * 1000;
    const start = `${startMs}000000`; // API expects nanoseconds
    return this._request('/api/prom/label', { start })
      .then((res: DataQueryResponse) => {
        if (res && res.data && res.data.values && res.data.values.length > 0) {
          return { status: 'success', message: 'Data source connected and labels found.' };
        }
        return {
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

    const request = queryRequestFromAnnotationOptions(options);
    const { data } = await this.runQuery(request, request.targets[0]).toPromise();
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

function queryRequestFromAnnotationOptions(options: AnnotationQueryRequest<LokiQuery>): DataQueryRequest<LokiQuery> {
  const refId = `annotation-${options.annotation.name}`;
  const target: LokiQuery = { refId, expr: options.annotation.expr };

  return {
    requestId: refId,
    range: options.range,
    targets: [target],
    dashboardId: options.dashboard.id,
    scopedVars: null,
    startTime: Date.now(),

    // This should mean the default defined on datasource is used.
    maxDataPoints: 0,

    // Dummy values, are required in type but not used here.
    timezone: 'utc',
    panelId: 0,
    interval: '',
    intervalMs: 0,
  };
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
