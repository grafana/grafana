define([
  'angular',
  'lodash',
  'jquery',
  'config',
<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
  'app/core/utils/datemath',
  './directives',
  './query_ctrl',
  './funcEditor',
  './addOpenfalconFunc',
],
function (angular, _, $, config, dateMath) {
=======
  'kbn',
  'moment',
  './queryCtrl',
  './funcEditor',
  './addGraphiteFunc',
],
function (angular, _, $, config, kbn, moment) {
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
  'use strict';

  var module = angular.module('grafana.services');

<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
  module.factory('OpenfalconDatasource', function($q, backendSrv, templateSrv) {

    function OpenfalconDatasource(datasource) {
=======
  module.factory('OpenFalconDatasource', function($q, backendSrv, templateSrv) {

    function OpenFalconDatasource(datasource) {
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
      this.basicAuth = datasource.basicAuth;
      this.url = datasource.url;
      this.name = datasource.name;
      this.cacheTimeout = datasource.cacheTimeout;
      this.withCredentials = datasource.withCredentials;
      this.render_method = datasource.render_method || 'POST';
    }

<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
    OpenfalconDatasource.prototype.query = function(options) {
=======
    OpenFalconDatasource.prototype.query = function(options) {
      // console.log('OpenFalconDatasource.prototype.query options =', options);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
      try {
        var graphOptions = {
          from: this.translateTime(options.range.from, 'round-down'),
          until: this.translateTime(options.range.to, 'round-up'),
          targets: options.targets,
          format: options.format,
          cacheTimeout: options.cacheTimeout || this.cacheTimeout,
          maxDataPoints: options.maxDataPoints,
        };
<<<<<<< 70a59f5f003c96f4042de4bf2623b4620c8b6632
<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b

        var params = this.buildOpenfalconParams(graphOptions, options.scopedVars);
=======
        // console.log('graphOptions =', graphOptions);
=======
>>>>>>> OWL-28 refinements

        var params = this.buildOpenFalconParams(graphOptions, options.scopedVars);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.

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
<<<<<<< 70a59f5f003c96f4042de4bf2623b4620c8b6632
<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
        return this.doOpenfalconRequest(httpOptions).then(this.convertDataPointsToMs);
=======
        // console.log('graphOptions =', graphOptions);
=======
>>>>>>> OWL-28 refinements
        return this.doOpenFalconRequest(httpOptions).then(this.convertDataPointsToMs);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
      }
      catch(err) {
        return $q.reject(err);
      }
    };

<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
    /**
     * @function name:  OpenfalconDatasource.prototype.convertDataPointsToMs = function(result)
     * @description:    This function gets hosts locations for map chart.
     * @related issues: OWL-168, OWL-052, OWL-030
     * @param:          object result
     * @return:         object results
     * @author:         Don Hsieh
     * @since:          08/20/2015
     * @last modified:  11/11/2015
     * @called by:      OpenfalconDatasource.prototype.query = function(options)
     *                   in public/app/plugins/datasource/openfalcon/datasource.js
     */
    OpenfalconDatasource.prototype.convertDataPointsToMs = function(result) {
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

    OpenfalconDatasource.prototype.annotationQuery = function(annotation, rangeUnparsed) {
      // Open-Falcon metric as annotation
      if (annotation.target) {
        var target = templateSrv.replace(annotation.target);
        var openFalconQuery = {
=======
    OpenFalconDatasource.prototype.convertDataPointsToMs = function(result) {
      // console.log('OpenFalconDatasource.prototype.convertDataPointsToMs result.data =', result.data);
      var data = [];
      var row = [];
      for (var i in result.data) {
        row = result.data[i];
        // console.log('row =', row);
        if ('Values' in row) {
          var values = row.Values;
          var metric = row.counter;
          var host = row.endpoint;

          var datapoints = [];
          var arr = [];
          var timestamp = 0;
          var value = 0;
          for (i in values) {
            arr = values[i];
            timestamp = arr['timestamp'];
            value = arr['value'];
            datapoints.push([value, timestamp]);
          }
          // console.log('convertDataPointsToMs datapoints =', datapoints);
          var obj = {};
          obj.datapoints = datapoints;
          obj.target = host + '.' + metric;
          data.push(obj);
        }
      }
      result.data = data;
      if (!result || !result.data) { return []; }
      for (i = 0; i < result.data.length; i++) {
        var series = result.data[i];
        // console.log('OpenFalconDatasource.prototype.convertDataPointsToMs series =', series);
        for (var y = 0; y < series.datapoints.length; y++) {
          series.datapoints[y][1] *= 1000;
        }
      }
      return result;
    };

    OpenFalconDatasource.prototype.annotationQuery = function(annotation, rangeUnparsed) {
      // Graphite metric as annotation
      if (annotation.target) {
        var target = templateSrv.replace(annotation.target);
        var graphiteQuery = {
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
          range: rangeUnparsed,
          targets: [{ target: target }],
          format: 'json',
          maxDataPoints: 100
        };

<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
        return this.query(openFalconQuery)
=======
        return this.query(graphiteQuery)
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
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
<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
            return list;
          });
      }
      // Open-Falcon event as annotation
=======

            return list;
          });
      }
      // Graphite event as annotation
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
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

<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
    OpenfalconDatasource.prototype.events = function(options) {
=======
    OpenFalconDatasource.prototype.events = function(options) {
      // console.log('OpenFalconDatasource.events options =', options);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
      try {
        var tags = '';
        if (options.tags) {
          tags = '&tags=' + options.tags;
        }

<<<<<<< 70a59f5f003c96f4042de4bf2623b4620c8b6632
<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
        return this.doOpenfalconRequest({
=======
        // console.log('OpenFalconDatasource.prototype.events options =', options);
=======
>>>>>>> OWL-28 refinements
        return this.doOpenFalconRequest({
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
          method: 'GET',
          url: '/events/get_data?from=' + this.translateTime(options.range.from) + '&until=' + this.translateTime(options.range.to) + tags,
        });
      }
      catch(err) {
        return $q.reject(err);
      }
    };

<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
    OpenfalconDatasource.prototype.translateTime = function(date, roundUp) {
=======
    OpenFalconDatasource.prototype.translateTime = function(date, rounding) {
<<<<<<< 70a59f5f003c96f4042de4bf2623b4620c8b6632
      // console.log('OpenFalconDatasource.prototype.translateTime date =', date);
      // console.log('OpenFalconDatasource.prototype.translateTime rounding =', rounding);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
=======
>>>>>>> OWL-28 refinements
      if (_.isString(date)) {
        if (date === 'now') {
          return 'now';
        }
<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
        else if (date.indexOf('now-') >= 0 && date.indexOf('/') === -1) {
=======
        else if (date.indexOf('now') >= 0) {
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
          date = date.substring(3);
          date = date.replace('m', 'min');
          date = date.replace('M', 'mon');
          return date;
        }
<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
        date = dateMath.parse(date, roundUp);
      }

      // graphite's from filter is exclusive
      // here we step back one minute in order
      // to guarantee that we get all the data that
      // exists for the specified range
      if (roundUp) {
=======
        date = kbn.parseDate(date);
      }

      date = moment.utc(date);

      if (rounding === 'round-up') {
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
        if (date.get('s')) {
          date.add(1, 'm');
        }
      }
<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
      else if (roundUp === false) {
=======
      else if (rounding === 'round-down') {
        // graphite' s from filter is exclusive
        // here we step back one minute in order
        // to guarantee that we get all the data that
        // exists for the specified range
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
        if (date.get('s')) {
          date.subtract(1, 'm');
        }
      }

      return date.unix();
    };

<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
    OpenfalconDatasource.prototype.metricFindQuery = function(query) {
      var interpolated;
      try {
        interpolated = encodeURIComponent(templateSrv.replace(query));
=======
    OpenFalconDatasource.prototype.metricFindQuery = function(query) {
      // console.log('metricFindQuery query =', query);
      var interpolated;
      try {
        interpolated = encodeURIComponent(templateSrv.replace(query));
<<<<<<< 70a59f5f003c96f4042de4bf2623b4620c8b6632
        // console.log('metricFindQuery query =', interpolated);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
=======
>>>>>>> OWL-28 refinements
      }
      catch(err) {
        return $q.reject(err);
      }

<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
      return this.doOpenfalconRequest({method: 'GET', url: '/metrics/find/?query=' + interpolated })
        .then(function(results) {
          return _.map(results.data, function(metric) {
=======
      return this.doOpenFalconRequest({method: 'GET', url: '/metrics/find/?query=' + interpolated })
        .then(function(results) {
          return _.map(results.data, function(metric) {
            // console.log('metricFindQuery metric =', metric);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
            return {
              text: metric.text,
              expandable: metric.expandable ? true : false
            };
          });
        });
    };

<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
    OpenfalconDatasource.prototype.testDatasource = function() {
=======
    OpenFalconDatasource.prototype.testDatasource = function() {
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
      return this.metricFindQuery('*').then(function () {
        return { status: "success", message: "Data source is working", title: "Success" };
      });
    };

<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
    OpenfalconDatasource.prototype.listDashboards = function(query) {
      return this.doOpenfalconRequest({ method: 'GET',  url: '/dashboard/find/', params: {query: query || ''} })
=======
    OpenFalconDatasource.prototype.listDashboards = function(query) {
      return this.doOpenFalconRequest({ method: 'GET',  url: '/dashboard/find/', params: {query: query || ''} })
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
        .then(function(results) {
          return results.data.dashboards;
        });
    };

<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
    OpenfalconDatasource.prototype.loadDashboard = function(dashName) {
      return this.doOpenfalconRequest({method: 'GET', url: '/dashboard/load/' + encodeURIComponent(dashName) });
    };

    OpenfalconDatasource.prototype.doOpenfalconRequest = function(options) {
=======
    OpenFalconDatasource.prototype.loadDashboard = function(dashName) {
      return this.doOpenFalconRequest({method: 'GET', url: '/dashboard/load/' + encodeURIComponent(dashName) });
    };

    OpenFalconDatasource.prototype.doOpenFalconRequest = function(options) {
      // console.log('OpenFalconDatasource.prototype.doOpenFalconRequest options =', options);
<<<<<<< 70a59f5f003c96f4042de4bf2623b4620c8b6632
      // this.url = 'http://localhost:4000';
      // this.url += ':4000';
      // options.url += '/';
      // console.log('this.url =', this.url);
      // console.log('options.url =', options.url);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
=======
>>>>>>> OWL-28 refinements
      if (this.basicAuth || this.withCredentials) {
        options.withCredentials = true;
      }
      if (this.basicAuth) {
        options.headers = options.headers || {};
        options.headers.Authorization = this.basicAuth;
      }

      options.url = this.url + options.url;

<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
      options.inspect = { type: 'openfalcon' };
      return backendSrv.datasourceRequest(options);
    };

    OpenfalconDatasource.prototype._seriesRefLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

    OpenfalconDatasource.prototype.buildOpenfalconParams = function(options, scopedVars) {
      var openFalcon_options = ['from', 'until', 'rawData', 'format', 'maxDataPoints', 'cacheTimeout'];
=======
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
      var graphite_options = ['from', 'until', 'rawData', 'format', 'maxDataPoints', 'cacheTimeout'];
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
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
<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
        if ($.inArray(key, openFalcon_options) === -1) { return; }
=======
        if ($.inArray(key, graphite_options) === -1) { return; }
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
        if (value) {
          clean_options.push(key + "=" + encodeURIComponent(value));
        }
      });

      return clean_options;
    };

<<<<<<< 48155c49f466021136cd8fff8665058dd59c198b
    return OpenfalconDatasource;
  });
});
=======
    return OpenFalconDatasource;
  });
<<<<<<< 70a59f5f003c96f4042de4bf2623b4620c8b6632
});
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
=======
});
>>>>>>> OWL-28 refinements
