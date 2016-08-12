define([
    'angular',
    'lodash'
  ],
  function (angular) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('AnomalyCtrl', function ($scope, healthSrv) {

      $scope.reload = function(){
        healthSrv.load().then(function (data) {
          $scope.applicationHealth = Math.floor(data.health);
          $scope.includeMetricsData = floor(data.includedMetricHealths);
          $scope.excludeMetricsData = floor(data.excludedMetricHealths);
        });
      };
      $scope.exclude = function(metricName){
        healthSrv.exclude(metricName);
        $scope.reload();
      };

      $scope.include = function(metricName){
        healthSrv.include(metricName);
        $scope.reload();
      };

      function floor(metrics) {
        _.each(metrics, function(metric) {
          metric.health = Math.floor(metric.health);
        });
        return metrics;
      }
      
      $scope.init = function () {
        $scope.reload();
      };
      $scope.init();
    });
  });
