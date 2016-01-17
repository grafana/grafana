define([
  'angular',
  'lodash',
  'jquery',
  'app/core/config',
  'app/core/utils/datemath',
  './query_ctrl',
  './func_editor',
  './add_openfalcon_func',
],
function (angular, _, $, config, dateMath) {
  'use strict';

  /** @ngInject */
  function OpenFalconDatasource(instanceSettings, $q, backendSrv, templateSrv) {
    this.basicAuth = instanceSettings.basicAuth;
    this.url = instanceSettings.url;
    this.name = instanceSettings.name;
    this.cacheTimeout = instanceSettings.cacheTimeout;
    this.withCredentials = instanceSettings.withCredentials;
    this.render_method = instanceSettings.render_method || 'POST';

    this.query = function(options) {
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
        if (params.length === 0) {
          return $q.when([]);
        }

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

    this.convertDataPointsToMs = function(result) {
      var obj = {};
      if (!result.data.length) {
        return result;
      }
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
    };

    this.annotationQuery = function(options, rangeUnparsed) {
      // OpenFalcon metric as annotation
      if (options.annotation.target) {
        var target = templateSrv.replace(options.annotation.target);
        var openfalconQuery = {
          rangeRaw: rangeUnparsed,
          targets: [{ target: target }],
          format: 'json',
          maxDataPoints: 100
        };

        return this.query(openfalconQuery)
        .then(function(result) {
          var list = [];

          for (var i = 0; i < result.data.length; i++) {
            var target = result.data[i];

            for (var y = 0; y < target.datapoints.length; y++) {
              var datapoint = target.datapoints[y];
              if (!datapoint[0]) { continue; }

              list.push({
                annotation: options.annotation,
                time: datapoint[1],
                title: target.target
              });
            }
          }

          return list;
        });
      }
      // OpenFalcon event as annotation
      else {
        var tags = templateSrv.replace(options.annotation.tags);
        return this.events({range: rangeUnparsed, tags: tags}).then(function(results) {
          var list = [];
          for (var i = 0; i < results.data.length; i++) {
            var e = results.data[i];

            list.push({
              annotation: options.annotation,
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

    this.events = function(options) {
      try {
        var tags = '';
        if (options.tags) {
          tags = '&tags=' + options.tags;
        }

        return this.doOpenFalconRequest({
          method: 'GET',
          url: '/events/get_data?from=' + this.translateTime(options.range.from, false) +
            '&until=' + this.translateTime(options.range.to, true) + tags,
        });
      }
      catch(err) {
        return $q.reject(err);
      }
    };

    this.translateTime = function(date, roundUp) {
      if (_.isString(date)) {
        if (date === 'now') {
          return 'now';
        }
        else if (date.indexOf('now-') >= 0 && date.indexOf('/') === -1) {
          date = date.substring(3);
          date = date.replace('m', 'min');
          date = date.replace('M', 'mon');
          return date;
        }
        date = dateMath.parse(date, roundUp);
      }

      // openfalcon' s from filter is exclusive
      // here we step back one minute in order
      // to guarantee that we get all the data that
      // exists for the specified range
      if (roundUp) {
        if (date.get('s')) {
          date.add(1, 'm');
        }
      }
      else if (roundUp === false) {
        if (date.get('s')) {
          date.subtract(1, 'm');
        }
      }

      return date.unix();
    };

    this.metricFindQuery = function(query) {
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

    this.testDatasource = function() {
      return this.metricFindQuery('').then(function () {
        return { status: "success", message: "Data source is working", title: "Success" };
      });
    };

    this.listDashboards = function(query) {
      return this.doOpenFalconRequest({ method: 'GET',  url: '/dashboard/find/', params: {query: query || ''} })
      .then(function(results) {
        return results.data.dashboards;
      });
    };

    this.loadDashboard = function(dashName) {
      return this.doOpenFalconRequest({method: 'GET', url: '/dashboard/load/' + encodeURIComponent(dashName) });
    };

    this.doOpenFalconRequest = function(options) {
      if (this.basicAuth || this.withCredentials) {
        options.withCredentials = true;
      }
      if (this.basicAuth) {
        options.headers = options.headers || {};
        options.headers.Authorization = this.basicAuth;
      }

      options.url = this.url + options.url;
      options.inspect = { type: 'openfalcon' };

      return backendSrv.datasourceRequest(options);
    };

    this._seriesRefLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    this.buildOpenFalconParams = function(options, scopedVars) {
      var openfalcon_options = ['from', 'until', 'rawData', 'format', 'maxDataPoints', 'cacheTimeout'];
      var clean_options = [], targets = {};
      var target, targetValue, i;
      var regex = /(\#[A-Z])/g;
      var intervalFormatFixRegex = /'(\d+)m'/gi;
      var hasTargets = false;

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

        hasTargets = true;
        clean_options.push("target=" + encodeURIComponent(targetValue));
      }

      _.each(options, function (value, key) {
        if ($.inArray(key, openfalcon_options) === -1) { return; }
        if (value) {
          clean_options.push(key + "=" + encodeURIComponent(value));
        }
      });

      if (!hasTargets) {
        return [];
      }

      return clean_options;
    };
  }

  return OpenFalconDatasource;
});
