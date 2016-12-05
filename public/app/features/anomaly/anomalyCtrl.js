define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('AnomalyCtrl', function ($scope, healthSrv, backendSrv, contextSrv) {
      $scope.init = function () {
        $scope.system = backendSrv.getSystemById(contextSrv.system);
        healthSrv.load().then(function (data) {
          $scope.applicationHealth = Math.floor(data.health);
          $scope.summary = data;
          $scope.includeMetricsData = healthSrv.floor(data.includedMetricHealths);
        });
      };
      $scope.init();
    });
  });
