import _ from 'lodash';

import * as dateMath from 'app/core/utils/datemath';
import { LogsStream, LogsModel, makeSeriesForLogs } from 'app/core/logs_model';
import { PluginMeta, DataQuery } from 'app/types';
import { addLabelToSelector } from 'app/plugins/datasource/prometheus/add_label_to_query';

import LanguageProvider from './language_provider';
import { mergeStreamsToLogs } from './result_transformer';
import { formatQuery, parseQuery } from './query_utils';

export const DEFAULT_LIMIT = 1000;

const DEFAULT_QUERY_PARAMS = {
  direction: 'BACKWARD',
  limit: DEFAULT_LIMIT,
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

export default class LokiDatasource {
  languageProvider: LanguageProvider;

  /** @ngInject */
  constructor(private instanceSettings, private backendSrv, private templateSrv) {
    this.languageProvider = new LanguageProvider(this);
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

  mergeStreams(streams: LogsStream[], intervalMs: number): LogsModel {
    const logs = mergeStreamsToLogs(streams);
    logs.series = makeSeriesForLogs(logs.rows, intervalMs);
    return logs;
  }

  prepareQueryTarget(target, options) {
    const interpolated = this.templateSrv.replace(target.expr);
    const start = this.getTime(options.range.from, false);
    const end = this.getTime(options.range.to, true);
    return {
      ...DEFAULT_QUERY_PARAMS,
      ...parseQuery(interpolated),
      start,
      end,
    };
  }

  query(options): Promise<{ data: LogsStream[] }> {
    const queryTargets = options.targets
      .filter(target => target.expr)
      .map(target => this.prepareQueryTarget(target, options));
    if (queryTargets.length === 0) {
      return Promise.resolve({ data: [] });
    }

    const queries = queryTargets.map(target => this._request('/api/prom/query', target));

    return Promise.all(queries).then((results: any[]) => {
      // Flatten streams from multiple queries
      const allStreams: LogsStream[] = results.reduce((acc, response, i) => {
        const streams: LogsStream[] = response.data.streams || [];
        // Inject search for match highlighting
        const search: string = queryTargets[i].regexp;
        streams.forEach(s => {
          s.search = search;
        });
        return [...acc, ...streams];
      }, []);
      return { data: allStreams };
    });
  }

  async importQueries(queries: DataQuery[], originMeta: PluginMeta): Promise<DataQuery[]> {
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

  modifyQuery(query: DataQuery, action: any): DataQuery {
    const parsed = parseQuery(query.expr || '');
    let selector = parsed.query;
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

  getHighlighterExpression(query: DataQuery): string {
    return parseQuery(query.expr).regexp;
  }

  getTime(date, roundUp) {
    if (_.isString(date)) {
      date = dateMath.parse(date, roundUp);
    }
    return Math.ceil(date.valueOf() * 1e6);
  }

  testDatasource() {
    return this._request('/api/prom/label')
      .then(res => {
        if (res && res.data && res.data.values && res.data.values.length > 0) {
          return { status: 'success', message: 'Data source connected and labels found.' };
        }
        return {
          status: 'error',
          message: 'Data source connected, but no labels received. Verify that Loki is configured properly.',
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
