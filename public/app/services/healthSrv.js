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
          _this.anomalyMetricsData = response.data;
          return response.data;
        }, function onFailed(response) {
          // alert something
          console.log("false");
          return response;
        });
      };
    });
  });
