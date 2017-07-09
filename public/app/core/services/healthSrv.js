define([
    'angular',
    'lodash',
    '../core_module',
],
function (angular, _, coreModule) {
    'use strict';
    coreModule.default.service('healthSrv', function ($http, backendSrv, $location, $q) {
      var anomalyListUrl = "/anomaly?by_groups=true";
      var excludeAnomaly = "/anomaly/exclude";
      var includeAnomaly = "/anomaly/include";
      var mainHealthList = "/healthsummary";
      var metricsType = "/metrictype";
      var anomalyHistory = "/anomaly";
      this.anomalyMetricsData = [];
      var _this = this;
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

      this.exclude = function (metricName, host) {
        return backendSrv.alertD({
          method: "post",
          url: excludeAnomaly,
          params: {
            metric: metricName,
            host: host
          }
        });
      };

      this.aggregateHealths = function (metricHostClusters) {
        _.each(metricHostClusters, function (cluster, index) {
          cluster.health = 0;
          for (var i = 0; i < cluster.elements.length; i++) {
            cluster.health += cluster.elements[i].health;
          }
          var divisor = cluster.numElements || 1;
          var health = cluster.numElements ? cluster.health : 100;
          cluster.health = Math.floor(health / divisor);
          cluster.index = index;
        });
        return metricHostClusters;
      };

      this.include = function (metricName, host) {
        return backendSrv.alertD({
          method: "post",
          url: includeAnomaly,
          params: {
            metric: metricName,
            host: host
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
        _.forEach(["/association", "/anomaly"], function (uri) {
          if ($location.path().indexOf(uri) > -1) {
            _.forEach(dashboard.rows, function (row) {
              _.forEach(row.panels, function (panel) {
                _.forEach(panel.targets, function (target) {
                  if (_.excludeMetricSuffix(target.metric)) {
                    targets[target.metric] = target;
                  }
                });
              });
            });

            if(!Object.keys(targets).length) {
              return;
            }
            var q = _this.getMetricsType(Object.keys(targets)).then(function onSuccess(response) {
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
          }
        });
        return $q.all(metricsTypeQueries);
      };

      this.loadHistory = function(options) {
        return backendSrv.alertD({
          method: "get",
          params: {
            from: options.from,
            to: options.to
          },
          url: anomalyHistory
        }).then(function onSuccess(response) {
          return response.data;
        }, function onFailed(response) {
          return response;
        });
      }
    });
  });
