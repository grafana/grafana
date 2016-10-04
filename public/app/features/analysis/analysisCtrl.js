define([
    'angular',
    'lodash'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('AnalysisCtrl', function ($scope, $location, datasourceSrv) {
      $scope.init = function () {
        var targetObj = {
          metric:"files_pending",
          currentTagKey:"host",
          currentTagValue:"121.42.46.103"
        };
        $scope.targetObj = targetObj;
        $scope.datasource = null;
        _.each(datasourceSrv.getAll(), function(ds) {
          if (ds.type === 'opentsdb') {
            datasourceSrv.get(ds.name).then(function(datasource) {
              $scope.datasource = datasource;
            });
          }
        });
      };

      $scope.analysis = function() {
        var target = {"metric":$scope.targetObj.metric,"tags":{}};
        target.tags[$scope.targetObj.currentTagKey] = $scope.targetObj.currentTagValue;
        window.decomposeTarget = target;
        $location.path("/decompose");
      };

      $scope.getTextValues = function(metricFindResult) {
        return _.map(metricFindResult, function(value) { return value.text; });
      };

      $scope.suggestMetrics = function(query, callback) {
        $scope.datasource.metricFindQuery('metrics(' + query + ')')
          .then($scope.getTextValues)
          .then(callback);
      };

      $scope.suggestTagKeys = function(query, callback) {
        $scope.datasource.metricFindQuery('suggest_tagk(' + query + ')')
          .then($scope.getTextValues)
          .then(callback);
      };

      $scope.suggestTagValues = function(query, callback) {
        $scope.datasource.metricFindQuery('suggest_tagv(' + query + ')')
          .then($scope.getTextValues)
          .then(callback);
      };

      $scope.init();
    });
  });
