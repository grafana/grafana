define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('AnomalyCtrl', function ($scope, healthSrv, backendSrv, contextSrv, $controller, $rootScope) {
      $scope.init = function () {
        $scope.system = backendSrv.getSystemById(contextSrv.user.systemId);
        healthSrv.load().then(function (data) {
          $scope.applicationHealth = Math.floor(data.health);
          $scope.summary = data;
          data.metricHostClusters.push(data.metricHostNotClustered);
          $scope.metricHostClusters = healthSrv.aggregateHealths(data.metricHostClusters);
          $scope.clustersLength = $scope.metricHostClusters.length;
          healthSrv.anomalyMetricsData = $scope.metricHostClusters;
          $scope.excludeMetricsData = healthSrv.floor(data.metricHostExcluded.elements);
          $scope.excludeMetricLength = _.size($scope.excludeMetricsData);
          $controller('ClusterCtrl', {$scope: $scope}).init();
        });
      };
      $scope.reload = function() {
        $scope.init();
      };

      $scope.changeExcludeMetrics = function () {
        $scope.appEvent('show-modal', {
          src: 'public/app/partials/exclude_metrics.html',
          modalClass: 'modal-no-header confirm-modal',
          scope: $scope.$new(),
        });
      };

      $rootScope.$on('anomaly-select', function (e, index) {
        $scope.$apply(function () {
          $scope.metricHostClusters = [healthSrv.anomalyMetricsData[index.seriesIndex]];
        });
      });

      $scope.init();
    });
  });
