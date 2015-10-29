define([
  'angular',
  'lodash',
  'app/core/utils/datemath',
  './influx_series',
  './query_builder',
  './directives',
  './query_ctrl',
],
function (angular, _, dateMath, InfluxSeries, InfluxQueryBuilder) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('InfluxDatasource', function($q, backendSrv, templateSrv) {

    function InfluxDatasource(datasource) {
      this.type = 'influxdb';
      this.urls = _.map(datasource.url.split(','), function(url) {
        return url.trim();
      });

      this.username = datasource.username;
      this.password = datasource.password;
      this.name = datasource.name;
      this.database = datasource.database;
      this.basicAuth = datasource.basicAuth;

      this.supportAnnotations = true;
      this.supportMetrics = true;
    }

    InfluxDatasource.prototype.query = function(options) {
      var timeFilter = getTimeFilter(options);
      var queryTargets = [];
      var i, y;

      var allQueries = _.map(options.targets, function(target) {
        if (target.hide) { return []; }

        queryTargets.push(target);

        // build query
        var queryBuilder = new InfluxQueryBuilder(target);
        var query =  queryBuilder.build();
        query = query.replace(/\$interval/g, (target.interval || options.interval));
        return query;

      }).join("\n");

      // replace grafana variables
      allQueries = allQueries.replace(/\$timeFilter/g, timeFilter);

      // replace templated variables
      allQueries = templateSrv.replace(allQueries, options.scopedVars);
      return this._seriesQuery(allQueries).then(function(data) {
        if (!data || !data.results) {
          return [];
        }

        var seriesList = [];
        for (i = 0; i < data.results.length; i++) {
          var result = data.results[i];
          if (!result || !result.series) { continue; }

          var alias = (queryTargets[i] || {}).alias;
          if (alias) {
            alias = templateSrv.replace(alias, options.scopedVars);
          }
          var targetSeries = new InfluxSeries({ series: data.results[i].series, alias: alias }).getTimeSeries();
          for (y = 0; y < targetSeries.length; y++) {
            seriesList.push(targetSeries[y]);
          }
        }

        return { data: seriesList };
      });
    };

    InfluxDatasource.prototype.annotationQuery = function(options) {
      var timeFilter = getTimeFilter({rangeRaw: options.rangeRaw});
      var query = options.annotation.query.replace('$timeFilter', timeFilter);
      query = templateSrv.replace(query);

      return this._seriesQuery(query).then(function(data) {
        if (!data || !data.results || !data.results[0]) {
          throw { message: 'No results in response from InfluxDB' };
        }
        return new InfluxSeries({series: data.results[0].series, annotation: options.annotation}).getAnnotations();
      });
    };

    InfluxDatasource.prototype.metricFindQuery = function (query) {
      var interpolated;
      try {
        interpolated = templateSrv.replace(query);
      }
      catch (err) {
        return $q.reject(err);
      }

      return this._seriesQuery(interpolated).then(function (results) {
        if (!results || results.results.length === 0) { return []; }

        var influxResults = results.results[0];
        if (!influxResults.series) {
          return [];
        }
        var series = influxResults.series[0];

        if (query.indexOf('SHOW MEASUREMENTS') === 0) {
          return _.map(series.values, function(value) { return { text: value[0], expandable: true }; });
        }

        var flattenedValues = _.flatten(series.values);
        return _.map(flattenedValues, function(value) { return { text: value, expandable: true }; });
      });
    };

    InfluxDatasource.prototype._seriesQuery = function(query) {
      return this._influxRequest('GET', '/query', {q: query, epoch: 'ms'});
    };

    InfluxDatasource.prototype.testDatasource = function() {
      return this.metricFindQuery('SHOW MEASUREMENTS LIMIT 1').then(function () {
        return { status: "success", message: "Data source is working", title: "Success" };
      });
    };

    InfluxDatasource.prototype._influxRequest = function(method, url, data) {
      var self = this;

      var currentUrl = self.urls.shift();
      self.urls.push(currentUrl);

      var params = {
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

      var options = {
        method: method,
        url:    currentUrl + url,
        params: params,
        data:   data,
        precision: "ms",
        inspect: { type: 'influxdb' },
      };

      options.headers = options.headers || {};
      if (self.basicAuth) {
        options.headers.Authorization = self.basicAuth;
      }

      return backendSrv.datasourceRequest(options).then(function(result) {
        return result.data;
      }, function(err) {
        if (err.status !== 0 || err.status >= 300) {
          if (err.data && err.data.error) {
            throw { message: 'InfluxDB Error Response: ' + err.data.error, data: err.data, config: err.config };
          }
          else {
            throw { messsage: 'InfluxDB Error: ' + err.message, data: err.data, config: err.config };
          }
        }
      });
    };

    function getTimeFilter(options) {
      var from = getInfluxTime(options.rangeRaw.from, false);
      var until = getInfluxTime(options.rangeRaw.to, true);
      var fromIsAbsolute = from[from.length-1] === 's';

      if (until === 'now()' && !fromIsAbsolute) {
        return 'time > ' + from;
      }

      return 'time > ' + from + ' and time < ' + until;
    }

    function getInfluxTime(date, roundUp) {
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

    return InfluxDatasource;

  });

});
