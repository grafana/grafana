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
<<<<<<< 95874f488acf04b56ea0735ac04ab9f7d20f7d27
<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
=======
      // console.log('OpenFalconDatasource.prototype.query options =', options);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
=======
>>>>>>> [OWL-30] Add Echarts map to Grafana
      try {
        var graphOptions = {
          from: this.translateTime(options.range.from, 'round-down'),
          until: this.translateTime(options.range.to, 'round-up'),
          targets: options.targets,
          format: options.format,
          cacheTimeout: options.cacheTimeout || this.cacheTimeout,
          maxDataPoints: options.maxDataPoints,
        };
<<<<<<< 73649fa8c74f0f6ef3f94eca7931e897a8d41f70
<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
=======
        // console.log('graphOptions =', graphOptions);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
=======
>>>>>>> OWL-28 refinements

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
<<<<<<< 73649fa8c74f0f6ef3f94eca7931e897a8d41f70
<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
=======
        // console.log('graphOptions =', graphOptions);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
=======
>>>>>>> OWL-28 refinements
        return this.doOpenFalconRequest(httpOptions).then(this.convertDataPointsToMs);
      }
      catch(err) {
        return $q.reject(err);
      }
    };

<<<<<<< 95874f488acf04b56ea0735ac04ab9f7d20f7d27
<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
    /**
     * @function name:  OpenFalconDatasource.prototype.convertDataPointsToMs = function(result)
     * @description:    This function gets hosts locations for map chart.
     * @related issues: OWL-052, OWL-030
=======
    /**
     * @function name:  OpenFalconDatasource.prototype.convertDataPointsToMs = function(result)
     * @description:    This function gets hosts locations for map chart.
     * @related issues: OWL-030
>>>>>>> [OWL-30] Add Echarts map to Grafana
     * @param:          object result
     * @return:         object results
     * @author:         Don Hsieh
     * @since:          08/20/2015
<<<<<<< 95874f488acf04b56ea0735ac04ab9f7d20f7d27
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
=======
=======
     * @last modified:  08/21/2015
     * @called by:      OpenFalconDatasource.prototype.query = function(options)
     *                   in public/app/plugins/datasource/openfalcon/datasource.js
     */
>>>>>>> [OWL-30] Add Echarts map to Grafana
    OpenFalconDatasource.prototype.convertDataPointsToMs = function(result) {
      // console.log('OpenFalconDatasource.prototype.convertDataPointsToMs result.data =', result.data);
      var obj = {};
      if (!result.data.length) return result;
      if ('city' in result.data[0]) {   // This is a map query
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
            // console.log('convertDataPointsToMs datapoints =', datapoints);
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

<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
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
<<<<<<< 95874f488acf04b56ea0735ac04ab9f7d20f7d27
<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
            return list;
          });
      }
      // Open-Falcon event as annotation
=======

=======
>>>>>>> [OWL-30] Add Echarts map to Grafana
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

    OpenFalconDatasource.prototype.events = function(options) {
<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
=======
      // console.log('OpenFalconDatasource.events options =', options);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
      try {
        var tags = '';
        if (options.tags) {
          tags = '&tags=' + options.tags;
        }

<<<<<<< 73649fa8c74f0f6ef3f94eca7931e897a8d41f70
<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
=======
        // console.log('OpenFalconDatasource.prototype.events options =', options);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
=======
>>>>>>> OWL-28 refinements
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
<<<<<<< 73649fa8c74f0f6ef3f94eca7931e897a8d41f70
<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
=======
      // console.log('OpenFalconDatasource.prototype.translateTime date =', date);
      // console.log('OpenFalconDatasource.prototype.translateTime rounding =', rounding);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
=======
>>>>>>> OWL-28 refinements
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
<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
        // open-falcon' s from filter is exclusive
=======
        // graphite' s from filter is exclusive
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
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
<<<<<<< 95874f488acf04b56ea0735ac04ab9f7d20f7d27
<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
      var interpolated;
      try {
        interpolated = encodeURIComponent(templateSrv.replace(query));
=======
      // console.log('metricFindQuery query =', query);
=======
      console.log('metricFindQuery query =', query);
>>>>>>> [OWL-30] Add Echarts map to Grafana
      var interpolated;
      try {
        interpolated = encodeURIComponent(templateSrv.replace(query));
<<<<<<< 73649fa8c74f0f6ef3f94eca7931e897a8d41f70
        // console.log('metricFindQuery query =', interpolated);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
=======
>>>>>>> OWL-28 refinements
      }
      catch(err) {
        return $q.reject(err);
      }

      return this.doOpenFalconRequest({method: 'GET', url: '/metrics/find/?query=' + interpolated })
        .then(function(results) {
<<<<<<< 73649fa8c74f0f6ef3f94eca7931e897a8d41f70
<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
          return _.map(results.data, function(metric) {
=======
          // console.log('metricFindQuery results =', results);
=======
>>>>>>> OWL-28 refinements
          return _.map(results.data, function(metric) {
<<<<<<< 95874f488acf04b56ea0735ac04ab9f7d20f7d27
            // console.log('metricFindQuery metric =', metric);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
=======
            console.log('metricFindQuery metric =', metric);
>>>>>>> [OWL-30] Add Echarts map to Grafana
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
<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
=======
      // console.log('OpenFalconDatasource.prototype.doOpenFalconRequest options =', options);
<<<<<<< 73649fa8c74f0f6ef3f94eca7931e897a8d41f70
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

      options.inspect = { type: 'graphite' };
<<<<<<< 73649fa8c74f0f6ef3f94eca7931e897a8d41f70
<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
=======
      // console.log('OpenFalconDatasource.prototype.doOpenFalconRequest options =', options);
      // console.log('OpenFalconDatasource.prototype.doOpenFalconRequest options.url =', options.url);
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
=======
>>>>>>> OWL-28 refinements
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
<<<<<<< 73649fa8c74f0f6ef3f94eca7931e897a8d41f70
<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
      var openFalcon_options = ['from', 'until', 'rawData', 'format', 'maxDataPoints', 'cacheTimeout'];
=======
      // console.log('OpenFalconDatasource.buildOpenFalconParams options =', options);
      // console.log('OpenFalconDatasource.buildOpenFalconParams scopedVars =', scopedVars);
=======
>>>>>>> OWL-28 refinements
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

      if (!clean_options.length) {
        clean_options.push("target=map");
      } else {}

      _.each(options, function (value, key) {
<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
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

    return OpenFalconDatasource;
  });
<<<<<<< 73649fa8c74f0f6ef3f94eca7931e897a8d41f70
<<<<<<< 2ba3d199a9dacbda5e0260a91a86d6daac02a1fa
});
=======
});
>>>>>>> [OWL-17] Add "Open-Falcon" data source.
=======
});
>>>>>>> OWL-28 refinements
