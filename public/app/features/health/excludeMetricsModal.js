define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('ExcludeMetricsModal', function ($scope, healthSrv) {
      $scope.init = function () {
        $scope.excludeMetric = "";
      };

      $scope.exclude = function () {
        healthSrv.exclude($scope.excludeMetric);
        $scope.reload();
      };

      $scope.include = function (metricName) {
        healthSrv.include(metricName);
        $scope.reload();
      };

      $scope.init();
    });
  });
