define([
  'angular',
  'lodash',
  'moment',
  'app/core/utils/datemath',
  './directives',
  './queryCtrl',
],
function (angular, _, moment, dateMath) {
  'use strict';

  var module = angular.module('grafana.services');

  var durationSplitRegexp = /(\d+)(ms|s|m|h|d|w|M|y)/;

  module.factory('PrometheusDatasource', function($q, backendSrv, templateSrv) {

    function PrometheusDatasource(datasource) {
      this.type = 'prometheus';
      this.editorSrc = 'app/features/prometheus/partials/query.editor.html';
      this.name = datasource.name;
      this.supportMetrics = true;

      this.url = datasource.url.replace(/\/$/g, '');
      this.directUrl = datasource.directUrl.replace(/\/$/g, '');
      this.basicAuth = datasource.basicAuth;
      this.lastErrors = {};
    }

    PrometheusDatasource.prototype._request = function(method, url) {
      var options = {
        url: this.url + url,
        method: method
      };

      if (this.basicAuth) {
        options.withCredentials = true;
        options.headers = {
          "Authorization": this.basicAuth
        };
      }

      return backendSrv.datasourceRequest(options);
    };

    // Called once per panel (graph)
    PrometheusDatasource.prototype.query = function(options) {
      var start = getPrometheusTime(options.range.from, false);
      var end = getPrometheusTime(options.range.to, true);

      var queries = [];
      _.each(options.targets, _.bind(function(target) {
        if (!target.expr || target.hide) {
          return;
        }

        var query = {};
        query.expr = templateSrv.replace(target.expr, options.scopedVars);

        var interval = target.interval || options.interval;
        var intervalFactor = target.intervalFactor || 1;
        query.step = this.calculateInterval(interval, intervalFactor);

        queries.push(query);
      }, this));

      // No valid targets, return the empty result to save a round trip.
      if (_.isEmpty(queries)) {
        var d = $q.defer();
        d.resolve({ data: [] });
        return d.promise;
      }

      var allQueryPromise = _.map(queries, _.bind(function(query) {
        return this.performTimeSeriesQuery(query, start, end);
      }, this));

      var self = this;
      return $q.all(allQueryPromise)
        .then(function(allResponse) {
          var result = [];

          _.each(allResponse, function(response, index) {
            if (response.status === 'error') {
              self.lastErrors.query = response.error;
              throw response.error;
            }
            delete self.lastErrors.query;

            _.each(response.data.data.result, function(metricData) {
              result.push(transformMetricData(metricData, options.targets[index]));
            });
          });

          return { data: result };
        });
    };

    PrometheusDatasource.prototype.performTimeSeriesQuery = function(query, start, end) {
      var url = '/api/v1/query_range?query=' + encodeURIComponent(query.expr) + '&start=' + start + '&end=' + end;

      var step = query.step;
      var range = Math.floor(end - start);
      // Prometheus drop query if range/step > 11000
      // calibrate step if it is too big
      if (step !== 0 && range / step > 11000) {
        step = Math.floor(range / 11000);
      }
      url += '&step=' + step;

      return this._request('GET', url);
    };

    PrometheusDatasource.prototype.performSuggestQuery = function(query) {
      var url = '/api/v1/label/__name__/values';

      return this._request('GET', url).then(function(result) {
        var suggestData = _.filter(result.data.data, function(metricName) {
          return metricName.indexOf(query) !==  1;
        });

        return suggestData;
      });
    };

    PrometheusDatasource.prototype.metricFindQuery = function(query) {
      if (!query) { return $q.when([]); }

      var interpolated;
      try {
        interpolated = templateSrv.replace(query);
      }
      catch (err) {
        return $q.reject(err);
      }

      var label_values_regex = /^label_values\(([^,]+)(?:,\s*(.+))?\)$/;
      var metric_names_regex = /^metrics\((.+)\)$/;

      var url;
      var label_values_query = interpolated.match(label_values_regex);
      if (label_values_query) {
        if (!label_values_query[2]) {
          // return label values globally
          url = '/api/v1/label/' + label_values_query[1] + '/values';

          return this._request('GET', url).then(function(result) {
            return _.map(result.data.data, function(value) {
              return {text: value};
            });
          });
        } else {
          var metric_query = 'count(' + label_values_query[1] + ') by (' +
                             label_values_query[2]  + ')';
          url = '/api/v1/query?query=' + encodeURIComponent(metric_query) +
                    '&time=' + (moment().valueOf() / 1000);

          return this._request('GET', url)
            .then(function(result) {
              if (result.data.data.result.length === 0 ||
                  _.keys(result.data.data.result[0].metric).length === 0) {
                return [];
              }
              return _.map(result.data.data.result, function(metricValue) {
                return {
                  text: metricValue.metric[label_values_query[2]],
                  expandable: true
                };
              });
            });
        }
      }

      var metric_names_query = interpolated.match(metric_names_regex);
      if (metric_names_query) {
        url = '/api/v1/label/__name__/values';

        return this._request('GET', url)
          .then(function(result) {
            return _.chain(result.data.data)
              .filter(function(metricName) {
                var r = new RegExp(metric_names_query[1]);
                return r.test(metricName);
              })
              .map(function(matchedMetricName) {
                return {
                  text: matchedMetricName,
                  expandable: true
                };
              })
              .value();
          });
      } else {
        // if query contains full metric name, return metric name and label list
        url = '/api/v1/query?query=' + encodeURIComponent(interpolated) +
              '&time=' + (moment().valueOf() / 1000);

        return this._request('GET', url)
          .then(function(result) {
            return _.map(result.data.data.result, function(metricData) {
              return {
                text: getOriginalMetricName(metricData.metric),
                expandable: true
              };
            });
          });
      }
    };

    PrometheusDatasource.prototype.testDatasource = function() {
      return this.metricFindQuery('metrics(.*)').then(function() {
        return { status: 'success', message: 'Data source is working', title: 'Success' };
      });
    };

    PrometheusDatasource.prototype.calculateInterval = function(interval, intervalFactor) {
      var m = interval.match(durationSplitRegexp);
      var dur = moment.duration(parseInt(m[1]), m[2]);
      var sec = dur.asSeconds();
      if (sec < 1) {
        sec = 1;
      }

      return Math.floor(sec * intervalFactor) + 's';
    };

    function transformMetricData(md, options) {
      var dps = [],
          metricLabel = null;

      metricLabel = createMetricLabel(md.metric, options);

      dps = _.map(md.values, function(value) {
        return [parseFloat(value[1]), value[0] * 1000];
      });

      return { target: metricLabel, datapoints: dps };
    }

    function createMetricLabel(labelData, options) {
      if (_.isUndefined(options) || _.isEmpty(options.legendFormat)) {
        return getOriginalMetricName(labelData);
      }

      var originalSettings = _.templateSettings;
      _.templateSettings = {
        interpolate: /\{\{(.+?)\}\}/g
      };

      var template = _.template(templateSrv.replace(options.legendFormat));
      var metricName;
      try {
        metricName = template(labelData);
      } catch (e) {
        metricName = '{}';
      }

      _.templateSettings = originalSettings;

      return metricName;
    }

    function getOriginalMetricName(labelData) {
      var metricName = labelData.__name__ || '';
      delete labelData.__name__;
      var labelPart = _.map(_.pairs(labelData), function(label) {
        return label[0] + '="' + label[1] + '"';
      }).join(',');
      return metricName + '{' + labelPart + '}';
    }

    function getPrometheusTime(date, roundUp) {
      if (_.isString(date)) {
        date = dateMath.parse(date, roundUp);
      }
      return (date.valueOf() / 1000).toFixed(0);
    }

    return PrometheusDatasource;
  });

});
