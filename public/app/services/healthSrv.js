define([
    'angular',
    'lodash',
    'config',
  ],
  function (angular) {
    'use strict';

    var module = angular.module('grafana.services');

    module.service('healthSrv', function ($http, backendSrv) {
      var anomalyListUrl = "";
      var _this = this;
      this.anomalyUrlRoot = "";
      this.anomalyMetricsData = [];
      this.applicationHealth = 0;

      this.init = function () {
        backendSrv.get('/api/alertsource').then(function (result) {
          _this.anomalyUrlRoot = result.alert.alert_urlroot;
          anomalyListUrl = _this.anomalyUrlRoot + "/anomaly";
        });
      };
      this.load = function () {
        return $http({
          method: "get",
          url: anomalyListUrl,
        }).then(function onSuccess(response) {
          _this.applicationHealth = response.data.health;
          _this.anomalyMetricsData = floor(response.data.metricHealths);
          return _this.anomalyMetricsData;
        }, function onFailed(response) {
          return response;
        });
      };
    });

    function floor(metrics) {
      _.each(metrics, function(metric) {
        metric.health = Math.floor(metric.health);
      });
      return metrics;
    }
  });
