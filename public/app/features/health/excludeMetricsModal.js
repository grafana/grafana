define([
    'angular',
  ],
  function (angular) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('ExcludeMetricsModal', function ($scope, healthSrv) {
      $scope.init = function () {
        $scope.excludeMetric = "";
      };

      $scope.include = function (anomalyDef) {
        healthSrv.include(anomalyDef.metric, anomalyDef.host).then(function () {
          $scope.reload();
        });
      };

      $scope.init();
    });
  });
