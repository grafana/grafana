///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

import * as dateMath from 'app/core/utils/datemath';
import InfluxSeries from './influx_series';
import InfluxQuery from './influx_query';
import ResponseParser from './response_parser';

export default class InfluxDatasource {
  type: string;
  urls: any;
  username: string;
  password: string;
  name: string;
  database: any;
  basicAuth: any;
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
    this.interval = (instanceSettings.jsonData || {}).timeInterval;
    this.supportAnnotations = true;
    this.supportMetrics = true;
    this.responseParser = new ResponseParser();
  }

  query(options) {
    var timeFilter = this.getTimeFilter(options);
    var queryTargets = [];
    var i, y;

    var allQueries = _.map(options.targets, (target) => {
      if (target.hide) { return ""; }

      queryTargets.push(target);

      // build query
      var queryModel = new InfluxQuery(target, this.templateSrv, options.scopedVars);
      var query =  queryModel.render(true);
      query = query.replace(/\$interval/g, (target.interval || options.interval));
      return query;
    }).reduce((acc, current) => {
      if (current !== "") {
        acc += ";" + current;
      }
      return acc;
    });

    // replace grafana variables
    allQueries = allQueries.replace(/\$timeFilter/g, timeFilter);

    // replace templated variables
    allQueries = this.templateSrv.replace(allQueries, options.scopedVars);

    return this._seriesQuery(allQueries).then((data): any => {
      if (!data || !data.results) {
        return [];
      }

      var seriesList = [];
      for (i = 0; i < data.results.length; i++) {
        var result = data.results[i];
        if (!result || !result.series) { continue; }

        var target = queryTargets[i];
        var alias = target.alias;
        if (alias) {
          alias = this.templateSrv.replace(target.alias, options.scopedVars);
        }

        var influxSeries = new InfluxSeries({ series: data.results[i].series, alias: alias });

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
  };

  annotationQuery(options) {
    if (!options.annotation.query) {
      return this.$q.reject({message: 'Query missing in annotation definition'});
    }

    var timeFilter = this.getTimeFilter({rangeRaw: options.rangeRaw});
    var query = options.annotation.query.replace('$timeFilter', timeFilter);
    query = this.templateSrv.replace(query, null, 'regex');

    return this._seriesQuery(query).then(data => {
      if (!data || !data.results || !data.results[0]) {
        throw { message: 'No results in response from InfluxDB' };
      }
      return new InfluxSeries({series: data.results[0].series, annotation: options.annotation}).getAnnotations();
    });
  };

  metricFindQuery(query) {
    var interpolated;
    try {
      interpolated = this.templateSrv.replace(query, null, 'regex');
    } catch (err) {
      return this.$q.reject(err);
    }

    return this._seriesQuery(interpolated)
      .then(_.curry(this.responseParser.parse)(query));
  };

  _seriesQuery(query) {
    if (!query) { return this.$q.when({results: []}); }

    return this._influxRequest('GET', '/query', {q: query, epoch: 'ms'});
  }


  serializeParams(params) {
    if (!params) { return '';}

    return _.reduce(params, (memo, value, key) => {
      if (value === null || value === undefined) { return memo; }
      memo.push(encodeURIComponent(key) + '=' + encodeURIComponent(value));
      return memo;
    }, []).join("&");
  }

  testDatasource() {
    return this.metricFindQuery('SHOW MEASUREMENTS LIMIT 1').then(() => {
      return { status: "success", message: "Data source is working", title: "Success" };
    });
  }

  _influxRequest(method, url, data) {
    var self = this;

    var currentUrl = self.urls.shift();
    self.urls.push(currentUrl);

    var params: any = {
      u: self.username,
      p: self.password,
    };

    if (self.database) {
      params.db = self.database;
    }

    if (method === 'GET') {
      _.extend(params, data);
      data = null;
    }

    var options: any = {
      method: method,
      url:    currentUrl + url,
      params: params,
      data:   data,
      precision: "ms",
      inspect: { type: 'influxdb' },
      paramSerializer: this.serializeParams,
    };

    options.headers = options.headers || {};
    if (self.basicAuth) {
      options.headers.Authorization = self.basicAuth;
    }

    return this.backendSrv.datasourceRequest(options).then(result => {
      return result.data;
    }, function(err) {
      if (err.status !== 0 || err.status >= 300) {
        if (err.data && err.data.error) {
          throw { message: 'InfluxDB Error Response: ' + err.data.error, data: err.data, config: err.config };
        } else {
          throw { message: 'InfluxDB Error: ' + err.message, data: err.data, config: err.config };
        }
      }
    });
  };

  getTimeFilter(options) {
    var from = this.getInfluxTime(options.rangeRaw.from, false);
    var until = this.getInfluxTime(options.rangeRaw.to, true);
    var fromIsAbsolute = from[from.length-1] === 's';

    if (until === 'now()' && !fromIsAbsolute) {
      return 'time > ' + from;
    }

    return 'time > ' + from + ' and time < ' + until;
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
    return (date.valueOf() / 1000).toFixed(0) + 's';
  }
}

