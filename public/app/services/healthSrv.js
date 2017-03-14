define([
    'angular',
    'lodash',
    'config',
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.services');

    module.service('healthSrv', function ($http, backendSrv, $location, $q) {
      var anomalyListUrl = "/anomaly";
      var excludeAnomaly = "/anomaly/exclude";
      var includeAnomaly = "/anomaly/include";
      var mainHealthList = "/healthsummary";
      var metricsType = "/metrictype";
      this.anomalyMetricsData = [];
      var _this = this;
      this.load = function () {
        return backendSrv.alertD({
          method: "get",
          url: anomalyListUrl
        }).then(function onSuccess(response) {
          _this.anomalyMetricsData = response.data.includedMetricHealths.concat(response.data.excludedMetricHealths);
          return response.data;
        }, function onFailed(response) {
          return response;
        });
      };

      this.exclude = function (metricName) {
        return backendSrv.alertD({
          method: "post",
          url: excludeAnomaly,
          params: {
            metric: metricName
          }
        });
      };

      this.include = function (metricName) {
        return backendSrv.alertD({
          method: "post",
          url: includeAnomaly,
          params: {
            metric: metricName
          }
        });
      };

      this.healthSummary = function () {
        return backendSrv.alertD({
          method: 'GET', url: mainHealthList, timeout: 2000
        });
      };

      this.getMetricType = function (metric) {
        return this.getMetricsType([metric])
      };

      this.getMetricsType = function (metrics) {
        return backendSrv.alertD({
          method: 'GET', url: metricsType, timeout: 2000,
          params: {
            names: metrics.join()
          }
        })
      };

      this.floor = function (metrics) {
        _.each(metrics, function (metric) {
          metric.health = Math.floor(metric.health);
        });
        return metrics;
      };

      this.transformMetricType = function (dashboard) {
        var metricsTypeQueries = [];
        _.forEach(["/association", "/anomaly"], function (subString) {
          if ($location.path().indexOf(subString) >= 0) {
            _.forEach(dashboard.rows, function (row) {
              _.forEach(row.panels, function (panel) {
                _.forEach(panel.targets, function (target) {
                  var q = _this.getMetricType(target.metric).then(function (response) {
                    var types = response.data;
                    if (types[target.metric] == "counter") {
                      target.shouldComputeRate = true;
                      target.downsampleAggregator = "max";
                    } else if (types[target.metric] == "increment") {
                      target.shouldComputeRate = false;
                      target.downsampleAggregator = "sum";
                    }
                  });
                  metricsTypeQueries.push(q);
                });
              });
            });
          }
        });
        return $q.all(metricsTypeQueries);
      };
    });
  });
