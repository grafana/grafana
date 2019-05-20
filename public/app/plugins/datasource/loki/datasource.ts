// Libraries
import _ from 'lodash';

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
} from '@grafana/ui/src/types';
import { LokiQuery, LokiOptions } from './types';
import { BackendSrv } from 'app/core/services/backend_srv';
import { TemplateSrv } from 'app/features/templating/template_srv';
import { safeStringifyValue } from 'app/core/utils/explore';
import { LogRowModel } from 'app/core/logs_model';

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

export class LokiDatasource extends DataSourceApi<LokiQuery, LokiOptions> {
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

  _request(apiUrl: string, data?, options?: any) {
    const baseUrl = this.instanceSettings.url;
    const params = data ? serializeParams(data) : '';
    const url = `${baseUrl}${apiUrl}?${params}`;
    const req = {
      ...options,
      url,
    };
    return this.backendSrv.datasourceRequest(req);
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

  async query(options: DataQueryRequest<LokiQuery>) {
    const queryTargets = options.targets
      .filter(target => target.expr && !target.hide)
      .map(target => this.prepareQueryTarget(target, options));

    if (queryTargets.length === 0) {
      return Promise.resolve({ data: [] });
    }

    const queries = queryTargets.map(target =>
      this._request('/api/prom/query', target).catch((err: any) => {
        if (err.cancelled) {
          return err;
        }

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

        throw error;
      })
    );

    return Promise.all(queries).then((results: any[]) => {
      const series: Array<SeriesData | DataQueryError> = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result.data) {
          const refId = queryTargets[i].refId;
          for (const stream of result.data.streams || []) {
            const seriesData = logStreamToSeriesData(stream);
            seriesData.refId = refId;
            seriesData.meta = {
              searchWords: getHighlighterExpressionsFromQuery(
                formatQuery(queryTargets[i].query, queryTargets[i].regexp)
              ),
              limit: this.maxLines,
            };
            series.push(seriesData);
          }
        }
      }

      return { data: series };
    });
  }

  async importQueries(queries: LokiQuery[], originMeta: PluginMeta): Promise<LokiQuery[]> {
    return this.languageProvider.importQueries(queries, originMeta.id);
  }

  metadataRequest(url) {
    // HACK to get label values for {job=|}, will be replaced when implementing LokiQueryField
    const apiUrl = url.replace('v1', 'prom');
    return this._request(apiUrl, { silent: true }).then(res => {
      const data = { data: { data: res.data.values || [] } };
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

  getTime(date, roundUp) {
    if (_.isString(date)) {
      date = dateMath.parse(date, roundUp);
    }
    return Math.ceil(date.valueOf() * 1e6);
  }

  prepareLogRowContextQueryTargets = (row: LogRowModel, limit: number) => {
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
    };
    return [
      // Target for "before" context
      {
        ...commontTargetOptons,
        start: timeEpochNs - contextTimeBuffer,
        end: timeEpochNs,
        direction: 'BACKWARD',
      },
      // Target for "after" context
      {
        ...commontTargetOptons,
        start: timeEpochNs, // TODO: We should add 1ns here for the original row not no be included in the result
        end: timeEpochNs + contextTimeBuffer,
        direction: 'FORWARD',
      },
    ];
  };

  getLogRowContext = (row: LogRowModel, limit?: number) => {
    // Preparing two targets, for preceeding and following log queries
    const targets = this.prepareLogRowContextQueryTargets(row, limit || 10);

    return Promise.all(
      targets.map(target => {
        return this._request('/api/prom/query', target).catch(e => {
          const error: DataQueryError = {
            message: 'Error during context query. Please check JS console logs.',
            status: e.status,
            statusText: e.statusText,
          };
          return error;
        });
      })
    ).then((results: any[]) => {
      const series: Array<Array<SeriesData | DataQueryError>> = [];
      const emptySeries = {
        fields: [],
        rows: [],
      } as SeriesData;

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        series[i] = [];
        if (result.data) {
          for (const stream of result.data.streams || []) {
            const seriesData = logStreamToSeriesData(stream);
            series[i].push(seriesData);
          }
        } else {
          series[i].push(result);
        }
      }

      // Following context logs are requested in "forward" direction.
      // This means, that we need to reverse those to make them sorted
      // in descending order (by timestamp)
      if (series[1][0] && (series[1][0] as SeriesData).rows) {
        (series[1][0] as SeriesData).rows.reverse();
      }

      return { data: [series[0][0] || emptySeries, series[1][0] || emptySeries] };
    });
  };

  testDatasource() {
    return this._request('/api/prom/label')
      .then(res => {
        if (res && res.data && res.data.values && res.data.values.length > 0) {
          return { status: 'success', message: 'Data source connected and labels found.' };
        }
        return {
          status: 'error',
          message:
            'Data source connected, but no labels received. Verify that Loki and Promtail is configured properly.',
        };
      })
      .catch(err => {
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
