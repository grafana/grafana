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
  supportAnnotations: boolean;
  supportMetrics: boolean;
  responseParser: any;

  /** @ngInject */
  constructor(instanceSettings, private $q, private backendSrv, private templateSrv) {
    this.type = 'influxdb';
    this.urls = _.map(instanceSettings.url.split(','), function(url) {
      return url.trim();
    });

    this.username = instanceSettings.username;
    this.password = instanceSettings.password;
    this.name = instanceSettings.name;
    this.database = instanceSettings.database;
    this.basicAuth = instanceSettings.basicAuth;
    this.withCredentials = instanceSettings.withCredentials;
    this.interval = (instanceSettings.jsonData || {}).timeInterval;
    this.supportAnnotations = true;
    this.supportMetrics = true;
    this.responseParser = new ResponseParser();
  }

  query(options) {
    var timeFilter = this.getTimeFilter(options);
    var scopedVars = options.scopedVars;
    var targets = _.cloneDeep(options.targets);
    var queryTargets = [];
    var queryModel;
    var i, y;

    var allQueries = _.map(targets, target => {
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
    var adhocFilters = this.templateSrv.getAdhocFilters(this.name);
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

      var seriesList = [];
      for (i = 0; i < data.results.length; i++) {
        var result = data.results[i];
        if (!result || !result.series) {
          continue;
        }

        var target = queryTargets[i];
        var alias = target.alias;
        if (alias) {
          alias = this.templateSrv.replace(target.alias, options.scopedVars);
        }

        var influxSeries = new InfluxSeries({
          series: data.results[i].series,
          alias: alias,
        });

        switch (target.resultFormat) {
          case 'table': {
            seriesList.push(influxSeries.getTable());
            break;
          }
          default: {
            var timeSeries = influxSeries.getTimeSeries();
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

    var timeFilter = this.getTimeFilter({ rangeRaw: options.rangeRaw });
    var query = options.annotation.query.replace('$timeFilter', timeFilter);
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
    for (let group of target.groupBy) {
      for (let param of group.params) {
        if (this.templateSrv.variableExists(param)) {
          return true;
        }
      }
    }

    for (let i in target.tags) {
      if (this.templateSrv.variableExists(target.tags[i].value)) {
        return true;
      }
    }

    return false;
  }

  metricFindQuery(query: string, options?: any) {
    var interpolated = this.templateSrv.replace(query, null, 'regex');

    return this._seriesQuery(interpolated, options).then(_.curry(this.responseParser.parse)(query));
  }

  getTagKeys(options) {
    var queryBuilder = new InfluxQueryBuilder({ measurement: '', tags: [] }, this.database);
    var query = queryBuilder.buildExploreQuery('TAG_KEYS');
    return this.metricFindQuery(query, options);
  }

  getTagValues(options) {
    var queryBuilder = new InfluxQueryBuilder({ measurement: '', tags: [] }, this.database);
    var query = queryBuilder.buildExploreQuery('TAG_VALUES', options.key);
    return this.metricFindQuery(query, options);
  }

  _seriesQuery(query: string, options?: any) {
    if (!query) {
      return this.$q.when({ results: [] });
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
    var queryBuilder = new InfluxQueryBuilder({ measurement: '', tags: [] }, this.database);
    var query = queryBuilder.buildExploreQuery('RETENTION POLICIES');

    return this._seriesQuery(query)
      .then(res => {
        let error = _.get(res, 'results[0].error');
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

    let params: any = {};

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

    let req: any = {
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
      function(err) {
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
    var from = this.getInfluxTime(options.rangeRaw.from, false);
    var until = this.getInfluxTime(options.rangeRaw.to, true);
    var fromIsAbsolute = from[from.length - 1] === 'ms';

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

      var parts = /^now-(\d+)([d|h|m|s])$/.exec(date);
      if (parts) {
        var amount = parseInt(parts[1]);
        var unit = parts[2];
        return 'now() - ' + amount + unit;
      }
      date = dateMath.parse(date, roundUp);
    }

    return date.valueOf() + 'ms';
  }
}
