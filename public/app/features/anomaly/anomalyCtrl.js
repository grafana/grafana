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
          $scope.summary.dangerMetricNum = 0;
          _.each($scope.metricHostClusters, function(cluster) {
            cluster.counter = _.countBy(cluster.elements, function(element) {
              if(element.health <= 25) {
                return 'unhealth';
              } else {
                return 'health';
              }
            });
            cluster.counter.unhealth = cluster.counter.unhealth || 0;
            $scope.summary.dangerMetricNum += cluster.counter.unhealth;
          });
          $scope.excludeMetricsData = healthSrv.floor(data.metricHostExcluded.elements);
          $controller('ClusterCtrl', {$scope: $scope}).init();
        });
        $scope.selected = 0;
      };
      $scope.reload = function() {
        $scope.init();
      };

      $scope.changeExcludeMetrics = function () {
        $scope.appEvent('show-modal', {
          src: './app/partials/exclude_metrics.html',
          modalClass: 'modal-no-header confirm-modal',
          scope: $scope.$new(),
        });
      };

      $rootScope.$on('anomaly-select', function (e, index) {
        $scope.$apply(function () {
          $scope.metricHostClusters = [healthSrv.anomalyMetricsData[index.seriesIndex]];
        });
      });

      $scope.exclude = function(anomaly) {
        _.each($scope.metricHostClusters, function(cluster) {
          _.remove(cluster.elements, function(element) {
            return _.isEqual(anomaly, element);
          });
        });
        healthSrv.exclude(anomaly.metric, anomaly.host);
        $scope.excludeMetricsData.push(anomaly);
      };

      $scope.include = function (anomalyDef) {
        healthSrv.include(anomalyDef.metric, anomalyDef.host).then(function () {
          $scope.reload();
        });
      };

      $scope.selectCluster = function(index) {
        if($scope.selected == index) {
          $scope.selected = -1;
        } else {
          $scope.selected = index;
        }
      };

      $scope.init();
    });
  });
