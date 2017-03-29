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
          data.metricHostClusters.push(data.metricHostNotClustered);
          $scope.metricHostClusters = healthSrv.aggregateHealths(data.metricHostClusters);
          healthSrv.anomalyMetricsData = $scope.metricHostClusters;
        });
      };

      // $scope.exclude = function (metric) {
      //   healthSrv.exclude(metric).then(function () {
      //     $scope.reload();
      //   });
      // };
      //
      // $scope.reload = function() {
      //   $scope.init();
      // };
      //
      // $scope.changeExcludeMetrics = function () {
      //   $scope.appEvent('show-modal', {
      //     src: './app/partials/exclude_metrics.html',
      //     modalClass: 'modal-no-header confirm-modal',
      //     scope: $scope.$new(),
      //   });
      // };

      $scope.init();
    });
  });
