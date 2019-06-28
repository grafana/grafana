// Libraries
import _ from 'lodash';
import { Subscription, of } from 'rxjs';
import { webSocket } from 'rxjs/webSocket';
import { catchError, map } from 'rxjs/operators';

// Services & Utils
import * as dateMath from '@grafana/ui/src/utils/datemath';
import { addLabelToSelector } from 'app/plugins/datasource/prometheus/add_label_to_query';
import LanguageProvider from './language_provider';
import { logStreamToSeriesData } from './result_transformer';
import { formatQuery, parseQuery, getHighlighterExpressionsFromQuery } from './query_utils';

// Types
import {
  PluginMeta,
  DataQueryRequest,
  SeriesData,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataQueryError,
  LogRowModel,
  DataStreamObserver,
  LoadingState,
  DataStreamState,
  DataQueryResponse,
  DateTime,
} from '@grafana/ui';
import { LokiQuery, LokiOptions } from './types';
import { BackendSrv } from 'app/core/services/backend_srv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { safeStringifyValue, convertToWebSocketUrl } from 'app/core/utils/explore';

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
  private subscriptions: { [key: string]: Subscription } = null;
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
    this.subscriptions = {};
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

  prepareLiveTarget(target: LokiQuery, options: DataQueryRequest<LokiQuery>) {
    const interpolated = this.templateSrv.replace(target.expr);
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
    };
  }

  prepareQueryTarget(target: LokiQuery, options: DataQueryRequest<LokiQuery>) {
    const interpolated = this.templateSrv.replace(target.expr);
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
      limit: this.maxLines,
      refId,
    };
  }

  unsubscribe = (refId: string) => {
    const subscription = this.subscriptions[refId];
    if (subscription && !subscription.closed) {
      subscription.unsubscribe();
      delete this.subscriptions[refId];
    }
  };

  processError = (err: any, target: any): DataQueryError => {
    const error: DataQueryError = {
      message: 'Unknown error during query transaction. Please check JS console logs.',
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

  processResult = (data: any, target: any): SeriesData[] => {
    const series: SeriesData[] = [];

    if (Object.keys(data).length === 0) {
      return series;
    }

    if (!data.streams) {
      return [{ ...logStreamToSeriesData(data), refId: target.refId }];
    }

    for (const stream of data.streams || []) {
      const seriesData = logStreamToSeriesData(stream);
      seriesData.refId = target.refId;
      seriesData.meta = {
        searchWords: getHighlighterExpressionsFromQuery(formatQuery(target.query, target.regexp)),
        limit: this.maxLines,
      };
      series.push(seriesData);
    }

    return series;
  };

  runLiveQueries = (options: DataQueryRequest<LokiQuery>, observer?: DataStreamObserver) => {
    const liveTargets = options.targets
      .filter(target => target.expr && !target.hide && target.live)
      .map(target => this.prepareLiveTarget(target, options));

    for (const liveTarget of liveTargets) {
      const subscription = webSocket(liveTarget.url)
        .pipe(
          map((results: any[]) => {
            const delta = this.processResult(results, liveTarget);
            const state: DataStreamState = {
              key: `loki-${liveTarget.refId}`,
              request: options,
              state: LoadingState.Streaming,
              delta,
              unsubscribe: () => this.unsubscribe(liveTarget.refId),
            };

            return state;
          }),
          catchError(err => {
            const error = this.processError(err, liveTarget);
            const state: DataStreamState = {
              key: `loki-${liveTarget.refId}`,
              request: options,
              state: LoadingState.Error,
              error,
              unsubscribe: () => this.unsubscribe(liveTarget.refId),
            };

            return of(state);
          })
        )
        .subscribe({
          next: state => observer(state),
        });

      this.subscriptions[liveTarget.refId] = subscription;
    }
  };

  runQueries = async (options: DataQueryRequest<LokiQuery>) => {
    const queryTargets = options.targets
      .filter(target => target.expr && !target.hide && !target.live)
      .map(target => this.prepareQueryTarget(target, options));

    if (queryTargets.length === 0) {
      return Promise.resolve({ data: [] });
    }

    const queries = queryTargets.map(target =>
      this._request('/api/prom/query', target).catch((err: any) => {
        if (err.cancelled) {
          return err;
        }

        const error: DataQueryError = this.processError(err, target);
        throw error;
      })
    );

    return Promise.all(queries).then((results: any[]) => {
      let series: SeriesData[] = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.data) {
          series = series.concat(this.processResult(result.data, queryTargets[i]));
        }
      }

      return { data: series };
    });
  };

  async query(options: DataQueryRequest<LokiQuery>, observer?: DataStreamObserver) {
    this.runLiveQueries(options, observer);

    return this.runQueries(options);
  }

  async importQueries(queries: LokiQuery[], originMeta: PluginMeta): Promise<LokiQuery[]> {
    return this.languageProvider.importQueries(queries, originMeta.id);
  }

  metadataRequest(url: string) {
    // HACK to get label values for {job=|}, will be replaced when implementing LokiQueryField
    const apiUrl = url.replace('v1', 'prom');
    return this._request(apiUrl, { silent: true }).then((res: DataQueryResponse) => {
      const data: any = { data: { data: res.data.values || [] } };
      return data;
    });
  }

  modifyQuery(query: LokiQuery, action: any): LokiQuery {
    const parsed = parseQuery(query.expr || '');
    let { query: selector } = parsed;
    switch (action.type) {
      case 'ADD_FILTER': {
        selector = addLabelToSelector(selector, action.key, action.value);
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
    if (_.isString(date)) {
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
        end: row.timestamp,
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
    const series: SeriesData[] = [];

    try {
      const result = await this._request('/api/prom/query', target);
      if (result.data) {
        for (const stream of result.data.streams || []) {
          const seriesData = logStreamToSeriesData(stream);
          series.push(seriesData);
        }
      }
      if (options && options.direction === 'FORWARD') {
        if (series[0] && series[0].rows) {
          series[0].rows.reverse();
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
    return this._request('/api/prom/label')
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
}

export default LokiDatasource;
