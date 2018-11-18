import _ from 'lodash';

import * as dateMath from 'app/core/utils/datemath';
import InfluxSeries from './influx_series';
import InfluxQuery from './influx_query';
import ResponseParser from './response_parser';
import { InfluxQueryBuilder } from './query_builder';

export default class InfluxDatasource {
  type: string;
  urls: any;
  username: string;
  password: string;
  name: string;
  database: any;
  basicAuth: any;
  withCredentials: any;
  interval: any;
  responseParser: any;

  /** @ngInject */
  constructor(instanceSettings, private $q, private backendSrv, private templateSrv) {
    this.type = 'influxdb';
    this.urls = _.map(instanceSettings.url.split(','), url => {
      return url.trim();
    });

    this.username = instanceSettings.username;
    this.password = instanceSettings.password;
    this.name = instanceSettings.name;
    this.database = instanceSettings.database;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.interval = (instanceSettings.jsonData || {}).timeInterval;
    this.responseParser = new ResponseParser();
  }

  query(options) {
    let timeFilter = this.getTimeFilter(options);
    const scopedVars = options.scopedVars;
    const targets = _.cloneDeep(options.targets);
    const queryTargets = [];
    let queryModel;
    let i, y;

    let allQueries = _.map(targets, target => {
      if (target.hide) {
        return '';
      }

      queryTargets.push(target);

      // backward compatibility
      scopedVars.interval = scopedVars.__interval;

      queryModel = new InfluxQuery(target, this.templateSrv, scopedVars);
      return queryModel.render(true);
    }).reduce((acc, current) => {
      if (current !== '') {
        acc += ';' + current;
      }
      return acc;
    });

    if (allQueries === '') {
      return this.$q.when({ data: [] });
    }

    // add global adhoc filters to timeFilter
    const adhocFilters = this.templateSrv.getAdhocFilters(this.name);
    if (adhocFilters.length > 0) {
      timeFilter += ' AND ' + queryModel.renderAdhocFilters(adhocFilters);
    }

    // replace grafana variables
    scopedVars.timeFilter = { value: timeFilter };

    // replace templated variables
    allQueries = this.templateSrv.replace(allQueries, scopedVars);

    return this._seriesQuery(allQueries, options).then((data): any => {
      if (!data || !data.results) {
        return [];
      }

      const seriesList = [];
      for (i = 0; i < data.results.length; i++) {
        const result = data.results[i];
        if (!result || !result.series) {
          continue;
        }

        const target = queryTargets[i];
        let alias = target.alias;
        if (alias) {
          alias = this.templateSrv.replace(target.alias, options.scopedVars);
        }

        const influxSeries = new InfluxSeries({
          series: data.results[i].series,
          alias: alias,
        });

        switch (target.resultFormat) {
          case 'table': {
            seriesList.push(influxSeries.getTable());
            break;
          }
          default: {
            const timeSeries = influxSeries.getTimeSeries();
            for (y = 0; y < timeSeries.length; y++) {
              seriesList.push(timeSeries[y]);
            }
            break;
          }
        }
      }

      return { data: seriesList };
    });
  }

  annotationQuery(options) {
    if (!options.annotation.query) {
      return this.$q.reject({
        message: 'Query missing in annotation definition',
      });
    }

    const timeFilter = this.getTimeFilter({ rangeRaw: options.rangeRaw });
    let query = options.annotation.query.replace('$timeFilter', timeFilter);
    query = this.templateSrv.replace(query, null, 'regex');

    return this._seriesQuery(query, options).then(data => {
      if (!data || !data.results || !data.results[0]) {
        throw { message: 'No results in response from InfluxDB' };
      }
      return new InfluxSeries({
        series: data.results[0].series,
        annotation: options.annotation,
      }).getAnnotations();
    });
  }

  targetContainsTemplate(target) {
    for (const group of target.groupBy) {
      for (const param of group.params) {
        if (this.templateSrv.variableExists(param)) {
          return true;
        }
      }
    }

    for (const i in target.tags) {
      if (this.templateSrv.variableExists(target.tags[i].value)) {
        return true;
      }
    }

    return false;
  }

  metricFindQuery(query: string, options?: any) {
    const interpolated = this.templateSrv.replace(query, null, 'regex');

    return this._seriesQuery(interpolated, options).then(_.curry(this.responseParser.parse)(query));
  }

  getTagKeys(options) {
    const queryBuilder = new InfluxQueryBuilder({ measurement: '', tags: [] }, this.database);
    const query = queryBuilder.buildExploreQuery('TAG_KEYS');
    return this.metricFindQuery(query, options);
  }

  getTagValues(options) {
    const queryBuilder = new InfluxQueryBuilder({ measurement: '', tags: [] }, this.database);
    const query = queryBuilder.buildExploreQuery('TAG_VALUES', options.key);
    return this.metricFindQuery(query, options);
  }

  _seriesQuery(query: string, options?: any) {
    if (!query) {
      return this.$q.when({ results: [] });
    }

    if (options && options.range) {
      const timeFilter = this.getTimeFilter({ rangeRaw: options.range });
      query = query.replace('$timeFilter', timeFilter);
    }

    return this._influxRequest('GET', '/query', { q: query, epoch: 'ms' }, options);
  }

  serializeParams(params) {
    if (!params) {
      return '';
    }

    return _.reduce(
      params,
      (memo, value, key) => {
        if (value === null || value === undefined) {
          return memo;
        }
        memo.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
        return memo;
      },
      []
    ).join('&');
  }

  testDatasource() {
    const queryBuilder = new InfluxQueryBuilder({ measurement: '', tags: [] }, this.database);
    const query = queryBuilder.buildExploreQuery('RETENTION POLICIES');

    return this._seriesQuery(query)
      .then(res => {
        const error = _.get(res, 'results[0].error');
        if (error) {
          return { status: 'error', message: error };
        }
        return { status: 'success', message: 'Data source is working' };
      })
      .catch(err => {
        return { status: 'error', message: err.message };
      });
  }

  _influxRequest(method: string, url: string, data: any, options?: any) {
    const currentUrl = this.urls.shift();
    this.urls.push(currentUrl);

    const params: any = {};

    if (this.username) {
      params.u = this.username;
      params.p = this.password;
    }

    if (options && options.database) {
      params.db = options.database;
    } else if (this.database) {
      params.db = this.database;
    }

    if (method === 'GET') {
      _.extend(params, data);
      data = null;
    }

    const req: any = {
      method: method,
      url: currentUrl + url,
      params: params,
      data: data,
      precision: 'ms',
      inspect: { type: 'influxdb' },
      paramSerializer: this.serializeParams,
    };

    req.headers = req.headers || {};
    if (this.basicAuth || this.withCredentials) {
      req.withCredentials = true;
    }
    if (this.basicAuth) {
      req.headers.Authorization = this.basicAuth;
    }

    return this.backendSrv.datasourceRequest(req).then(
      result => {
        return result.data;
      },
      err => {
        if (err.status !== 0 || err.status >= 300) {
          if (err.data && err.data.error) {
            throw {
              message: 'InfluxDB Error: ' + err.data.error,
              data: err.data,
              config: err.config,
            };
          } else {
            throw {
              message: 'Network Error: ' + err.statusText + '(' + err.status + ')',
              data: err.data,
              config: err.config,
            };
          }
        }
      }
    );
  }

  getTimeFilter(options) {
    const from = this.getInfluxTime(options.rangeRaw.from, false);
    const until = this.getInfluxTime(options.rangeRaw.to, true);
    const fromIsAbsolute = from[from.length - 1] === 'ms';

    if (until === 'now()' && !fromIsAbsolute) {
      return 'time >= ' + from;
    }

    return 'time >= ' + from + ' and time <= ' + until;
  }

  getInfluxTime(date, roundUp) {
    if (_.isString(date)) {
      if (date === 'now') {
        return 'now()';
      }

      const parts = /^now-(\d+)([d|h|m|s])$/.exec(date);
      if (parts) {
        const amount = parseInt(parts[1], 10);
        const unit = parts[2];
        return 'now() - ' + amount + unit;
      }
      date = dateMath.parse(date, roundUp);
    }

    return date.valueOf() + 'ms';
  }
}
