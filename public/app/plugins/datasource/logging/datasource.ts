import _ from 'lodash';

import * as dateMath from 'app/core/utils/datemath';

import { processStreams } from './result_transformer';

const DEFAULT_LIMIT = 100;

const DEFAULT_QUERY_PARAMS = {
  direction: 'BACKWARD',
  limit: DEFAULT_LIMIT,
  regexp: '',
  query: '',
};

const QUERY_REGEXP = /({\w+="[^"]+"})?\s*(\w[^{]+)?\s*({\w+="[^"]+"})?/;
export function parseQuery(input: string) {
  const match = input.match(QUERY_REGEXP);
  let query = '';
  let regexp = '';

  if (match) {
    if (match[1]) {
      query = match[1];
    }
    if (match[2]) {
      regexp = match[2].trim();
    }
    if (match[3]) {
      if (match[1]) {
        query = `${match[1].slice(0, -1)},${match[3].slice(1)}`;
      } else {
        query = match[3];
      }
    }
  }

  return { query, regexp };
}

function serializeParams(data: any) {
  return Object.keys(data)
    .map(k => {
      const v = data[k];
      return encodeURIComponent(k) + '=' + encodeURIComponent(v);
    })
    .join('&');
}

export default class LoggingDatasource {
  /** @ngInject */
  constructor(private instanceSettings, private backendSrv, private templateSrv) {}

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

  query(options) {
    const queryTargets = options.targets
      .filter(target => target.expr)
      .map(target => this.prepareQueryTarget(target, options));
    if (queryTargets.length === 0) {
      return Promise.resolve({ data: [] });
    }

    const queries = queryTargets.map(target => this._request('/api/prom/query', target));

    return Promise.all(queries).then((results: any[]) => {
      // Flatten streams from multiple queries
      const allStreams = results.reduce((acc, response, i) => {
        const streams = response.data.streams || [];
        // Inject search for match highlighting
        const search = queryTargets[i].regexp;
        streams.forEach(s => {
          s.search = search;
        });
        return [...acc, ...streams];
      }, []);
      const model = processStreams(allStreams, DEFAULT_LIMIT);
      return { data: model };
    });
  }

  metadataRequest(url) {
    // HACK to get label values for {job=|}, will be replaced when implementing LoggingQueryField
    const apiUrl = url.replace('v1', 'prom');
    return this._request(apiUrl, { silent: true }).then(res => {
      const data = { data: { data: res.data.values || [] } };
      return data;
    });
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
          message: 'Data source connected, but no labels received. Verify that logging is configured properly.',
        };
      })
      .catch(err => {
        return { status: 'error', message: err.message };
      });
  }
}
