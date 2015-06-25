define([
  'angular',
  'lodash',
  'kbn',
  './influxSeries',
  './queryBuilder',
  './queryCtrl',
  './funcEditor',
],
function (angular, _, kbn, InfluxSeries, InfluxQueryBuilder) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('InfluxDatasource', function($q, $http, templateSrv) {

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
      this.editorSrc = 'app/features/influxdb/partials/query.editor.html';
      this.annotationEditorSrc = 'app/features/influxdb/partials/annotations.editor.html';
    }

    InfluxDatasource.prototype.query = function(options) {
      var timeFilter = getTimeFilter(options);

      var promises = _.map(options.targets, function(target) {
        if (target.hide) {
          return [];
        }

        // build query
        var queryBuilder = new InfluxQueryBuilder(target);
        var query = queryBuilder.build();

        // replace grafana variables
        query = query.replace('$timeFilter', timeFilter);
        query = query.replace(/\$interval/g, (target.interval || options.interval));

        // replace templated variables
        query = templateSrv.replace(query, options.scopedVars);

        var alias = target.alias ? templateSrv.replace(target.alias, options.scopedVars) : '';

        var handleResponse = _.partial(handleInfluxQueryResponse, alias);
        return this._seriesQuery(query).then(handleResponse);

      }, this);

      return $q.all(promises).then(function(results) {
        return { data: _.flatten(results) };
      });
    };

    InfluxDatasource.prototype.annotationQuery = function(annotation, rangeUnparsed) {
      var timeFilter = getTimeFilter({ range: rangeUnparsed });
      var query = annotation.query.replace('$timeFilter', timeFilter);
      query = templateSrv.replace(query);

      return this._seriesQuery(query).then(function(data) {
        if (!data || !data.results || !data.results[0]) {
          throw { message: 'No results in response from InfluxDB' };
        }
        return new InfluxSeries({ series: data.results[0].series, annotation: annotation }).getAnnotations();
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

    function retry(deferred, callback, delay) {
      return callback().then(undefined, function(reason) {
        if (reason.status !== 0 || reason.status >= 300) {
          if (reason.data && reason.data.error) {
            reason.message = 'InfluxDB Error Response: ' + reason.data.error;
          }
          else {
            reason.message = 'InfluxDB Error: ' + reason.message;
          }
          deferred.reject(reason);
        }
        else {
          setTimeout(function() {
            return retry(deferred, callback, Math.min(delay * 2, 30000));
          }, delay);
        }
      });
    }

    InfluxDatasource.prototype._seriesQuery = function(query) {
      return this._influxRequest('GET', '/query', {q: query});
    };

    InfluxDatasource.prototype.testDatasource = function() {
      return this.metricFindQuery('SHOW MEASUREMENTS LIMIT 1').then(function () {
        return { status: "success", message: "Data source is working", title: "Success" };
      });
    };

    InfluxDatasource.prototype._influxRequest = function(method, url, data) {
      var self = this;
      var deferred = $q.defer();

      retry(deferred, function() {
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

        return $http(options).success(function (data) {
          deferred.resolve(data);
        });
      }, 10);

      return deferred.promise;
    };

    function handleInfluxQueryResponse(alias, data) {
      if (!data || !data.results || !data.results[0].series) {
        return [];
      }
      return new InfluxSeries({ series: data.results[0].series, alias: alias }).getTimeSeries();
    }

    function getTimeFilter(options) {
      var from = getInfluxTime(options.range.from);
      var until = getInfluxTime(options.range.to);
      var fromIsAbsolute = from[from.length-1] === 's';

      if (until === 'now()' && !fromIsAbsolute) {
        return 'time > ' + from;
      }

      return 'time > ' + from + ' and time < ' + until;
    }

    function getInfluxTime(date) {
      if (_.isString(date)) {
        return date.replace('now', 'now()').replace('-', ' - ');
      }

      return to_utc_epoch_seconds(date);
    }

    function to_utc_epoch_seconds(date) {
      return (date.getTime() / 1000).toFixed(0) + 's';
    }

    return InfluxDatasource;

  });

});
