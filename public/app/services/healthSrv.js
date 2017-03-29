define([
    'angular',
    'lodash',
    'config',
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.services');

    module.service('healthSrv', function ($http, backendSrv, $location, $q) {
      var anomalyListUrl = "/anomaly?by_groups=true";
      var excludeAnomaly = "/anomaly/exclude";
      var includeAnomaly = "/anomaly/include";
      var mainHealthList = "/healthsummary";
      var metricsType = "/metrictype";
      this.anomalyMetricsData = [];
      var _this = this;
      var dashboardId = -1;
      this.load = function () {
        return backendSrv.alertD({
          method: "get",
          url: anomalyListUrl
        }).then(function onSuccess(response) {
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

      this.aggregateHealths = function (metricHostClusters) {
        _.each(metricHostClusters, function (cluster) {
          cluster.health = 0;
          for (var i = 0; i < cluster.elements.length; i++) {
            cluster.health += cluster.elements[i].health;
          }
          cluster.health = Math.floor(cluster.health / cluster.numElements);
        });
        return metricHostClusters;
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
        var targets = {};
        var metricsTypeQueries = [];
        _.forEach(["/association", "/anomaly"], function (subString) {
          if ($location.path().indexOf(subString) >= 0 && dashboardId != dashboard.id) {
            _.forEach(dashboard.rows, function (row) {
              _.forEach(row.panels, function (panel) {
                _.forEach(panel.targets, function (target) {
                  if (_.excludeMetricSuffix(target.metric)) {
                    targets[target.metric] = target;
                  }
                });
              });
            });
            var q = _this.getMetricsType(Object.keys(targets)).then(function (response) {
              var types = response.data;
              _.each(Object.keys(targets), function (key) {
                if (types[key] == "counter") {
                  targets[key].shouldComputeRate = true;
                  targets[key].downsampleAggregator = "max";
                } else if (types[key] == "increment") {
                  targets[key].shouldComputeRate = false;
                  targets[key].downsampleAggregator = "sum";
                }
              });
            });
            metricsTypeQueries.push(q);
            dashboardId = dashboard.id;
          }
        });
        return $q.all(metricsTypeQueries);
      };
    });
  });
