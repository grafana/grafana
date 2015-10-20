define([
  'angular',
  'lodash',
  'jquery',
  'config',
  'kbn',
  'moment',
  './queryCtrl',
  './funcEditor',
  './addGraphiteFunc',
],
function (angular, _, $, config, kbn, moment) {
  'use strict';

  var module = angular.module('grafana.services');

  module.factory('OpenFalconDatasource', function($q, backendSrv, templateSrv) {

    function OpenFalconDatasource(datasource) {
      this.basicAuth = datasource.basicAuth;
      this.url = datasource.url;
      this.name = datasource.name;
      this.cacheTimeout = datasource.cacheTimeout;
      this.withCredentials = datasource.withCredentials;
      this.render_method = datasource.render_method || 'POST';
    }

    OpenFalconDatasource.prototype.query = function(options) {
      try {
        var graphOptions = {
          from: this.translateTime(options.range.from, 'round-down'),
          until: this.translateTime(options.range.to, 'round-up'),
          targets: options.targets,
          format: options.format,
          cacheTimeout: options.cacheTimeout || this.cacheTimeout,
          maxDataPoints: options.maxDataPoints,
        };

        var params = this.buildOpenFalconParams(graphOptions, options.scopedVars);

        if (options.format === 'png') {
          return $q.when(this.url + '/render' + '?' + params.join('&'));
        }

        var httpOptions = { method: this.render_method, url: '/render' };

        if (httpOptions.method === 'GET') {
          httpOptions.url = httpOptions.url + '?' + params.join('&');
        }
        else {
          httpOptions.data = params.join('&');
          httpOptions.headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
        }
        return this.doOpenFalconRequest(httpOptions).then(this.convertDataPointsToMs);
      }
      catch(err) {
        return $q.reject(err);
      }
    };

    /**
     * @function name:  OpenFalconDatasource.prototype.convertDataPointsToMs = function(result)
     * @description:    This function gets hosts locations for map chart.
     * @related issues: OWL-052, OWL-030
     * @param:          object result
     * @return:         object results
     * @author:         Don Hsieh
     * @since:          08/20/2015
     * @last modified:  08/27/2015
     * @called by:      OpenFalconDatasource.prototype.query = function(options)
     *                   in public/app/plugins/datasource/openfalcon/datasource.js
     */
    OpenFalconDatasource.prototype.convertDataPointsToMs = function(result) {
      var obj = {};
      if (!result.data.length) {
        return result;
      }
      if ('chartType' in result.data[0]) {   // This is a map query
        obj.datapoints = result.data;
        result.data = [obj];
        return result;
      } else {
        var data = [];
        var datapoints = [];
        var timestamp = 0;
        var value = 0;
        var values = [];
        var metric = '';
        var host = '';
        _.forEach(result.data, function(row) {
          if ('Values' in row) {
            values = row.Values;
            metric = row.counter;
            host = row.endpoint;

            datapoints = [];
            _.forEach(values, function(arr) {
              timestamp = arr['timestamp'];
              value = arr['value'];
              datapoints.push([value, timestamp]);
            });
            obj = {};
            obj.datapoints = datapoints;
            obj.target = host + '.' + metric;
            data.push(obj);
          }
        });
        result.data = data;
        if (!result || !result.data) { return []; }
        for (var i = 0; i < result.data.length; i++) {
          var series = result.data[i];
          for (var y = 0; y < series.datapoints.length; y++) {
            series.datapoints[y][1] *= 1000;
          }
        }
        return result;
      }
    };

    OpenFalconDatasource.prototype.annotationQuery = function(annotation, rangeUnparsed) {
      // Open-Falcon metric as annotation
      if (annotation.target) {
        var target = templateSrv.replace(annotation.target);
        var openFalconQuery = {
          range: rangeUnparsed,
          targets: [{ target: target }],
          format: 'json',
          maxDataPoints: 100
        };

        return this.query(openFalconQuery)
          .then(function(result) {
            var list = [];

            for (var i = 0; i < result.data.length; i++) {
              var target = result.data[i];

              for (var y = 0; y < target.datapoints.length; y++) {
                var datapoint = target.datapoints[y];
                if (!datapoint[0]) { continue; }

                list.push({
                  annotation: annotation,
                  time: datapoint[1],
                  title: target.target
                });
              }
            }
            return list;
          });
      }
      // Open-Falcon event as annotation
      else {
        var tags = templateSrv.replace(annotation.tags);
        return this.events({ range: rangeUnparsed, tags: tags })
          .then(function(results) {
            var list = [];
            for (var i = 0; i < results.data.length; i++) {
              var e = results.data[i];

              list.push({
                annotation: annotation,
                time: e.when * 1000,
                title: e.what,
                tags: e.tags,
                text: e.data
              });
            }
            return list;
          });
      }
    };

    OpenFalconDatasource.prototype.events = function(options) {
      try {
        var tags = '';
        if (options.tags) {
          tags = '&tags=' + options.tags;
        }

        return this.doOpenFalconRequest({
          method: 'GET',
          url: '/events/get_data?from=' + this.translateTime(options.range.from) + '&until=' + this.translateTime(options.range.to) + tags,
        });
      }
      catch(err) {
        return $q.reject(err);
      }
    };

    OpenFalconDatasource.prototype.translateTime = function(date, rounding) {
      if (_.isString(date)) {
        if (date === 'now') {
          return 'now';
        }
        else if (date.indexOf('now') >= 0) {
          date = date.substring(3);
          date = date.replace('m', 'min');
          date = date.replace('M', 'mon');
          return date;
        }
        date = kbn.parseDate(date);
      }

      date = moment.utc(date);

      if (rounding === 'round-up') {
        if (date.get('s')) {
          date.add(1, 'm');
        }
      }
      else if (rounding === 'round-down') {
        // open-falcon' s from filter is exclusive
        // here we step back one minute in order
        // to guarantee that we get all the data that
        // exists for the specified range
        if (date.get('s')) {
          date.subtract(1, 'm');
        }
      }

      return date.unix();
    };

    OpenFalconDatasource.prototype.metricFindQuery = function(query) {
      var interpolated;
      try {
        interpolated = encodeURIComponent(templateSrv.replace(query));
      }
      catch(err) {
        return $q.reject(err);
      }

      return this.doOpenFalconRequest({method: 'GET', url: '/metrics/find/?query=' + interpolated })
        .then(function(results) {
          return _.map(results.data, function(metric) {
            return {
              text: metric.text,
              expandable: metric.expandable ? true : false
            };
          });
        });
    };

    OpenFalconDatasource.prototype.testDatasource = function() {
      return this.metricFindQuery('*').then(function () {
        return { status: "success", message: "Data source is working", title: "Success" };
      });
    };

    OpenFalconDatasource.prototype.listDashboards = function(query) {
      return this.doOpenFalconRequest({ method: 'GET',  url: '/dashboard/find/', params: {query: query || ''} })
        .then(function(results) {
          return results.data.dashboards;
        });
    };

    OpenFalconDatasource.prototype.loadDashboard = function(dashName) {
      return this.doOpenFalconRequest({method: 'GET', url: '/dashboard/load/' + encodeURIComponent(dashName) });
    };

    OpenFalconDatasource.prototype.doOpenFalconRequest = function(options) {
      if (this.basicAuth || this.withCredentials) {
        options.withCredentials = true;
      }
      if (this.basicAuth) {
        options.headers = options.headers || {};
        options.headers.Authorization = this.basicAuth;
      }

      options.url = this.url + options.url;

      options.inspect = { type: 'graphite' };
      return backendSrv.datasourceRequest(options);
    };

    OpenFalconDatasource.prototype._seriesRefLetters = [
      '#A', '#B', '#C', '#D',
      '#E', '#F', '#G', '#H',
      '#I', '#J', '#K', '#L',
      '#M', '#N', '#O', '#P',
      '#Q', '#R', '#S', '#T',
      '#U', '#V', '#W', '#X',
      '#Y', '#Z'
    ];

    OpenFalconDatasource.prototype.buildOpenFalconParams = function(options, scopedVars) {
      var openFalcon_options = ['from', 'until', 'rawData', 'format', 'maxDataPoints', 'cacheTimeout'];
      var clean_options = [], targets = {};
      var target, targetValue, i;
      var regex = /(\#[A-Z])/g;
      var intervalFormatFixRegex = /'(\d+)m'/gi;

      if (options.format !== 'png') {
        options['format'] = 'json';
      }

      function fixIntervalFormat(match) {
        return match.replace('m', 'min').replace('M', 'mon');
      }

      for (i = 0; i < options.targets.length; i++) {
        target = options.targets[i];
        if (!target.target) {
          continue;
        }

        targetValue = templateSrv.replace(target.target, scopedVars);
        targetValue = targetValue.replace(intervalFormatFixRegex, fixIntervalFormat);
        targets[this._seriesRefLetters[i]] = targetValue;
      }

      function nestedSeriesRegexReplacer(match) {
        return targets[match];
      }

      for (i = 0; i < options.targets.length; i++) {
        target = options.targets[i];
        if (!target.target || target.hide) {
          continue;
        }

        targetValue = targets[this._seriesRefLetters[i]];
        targetValue = targetValue.replace(regex, nestedSeriesRegexReplacer);
        targets[this._seriesRefLetters[i]] = targetValue;

        clean_options.push("target=" + encodeURIComponent(targetValue));
      }

      _.each(options, function (value, key) {
        if ($.inArray(key, openFalcon_options) === -1) { return; }
        if (value) {
          clean_options.push(key + "=" + encodeURIComponent(value));
        }
      });

      return clean_options;
    };

    return OpenFalconDatasource;
  });
});