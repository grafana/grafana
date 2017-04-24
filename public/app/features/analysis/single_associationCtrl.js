define([
    'angular',
    'lodash',
    'app/features/org/alertAssociationCtrl'
  ],
  function (angular, _) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('SingleAssociationCtrl', function ($scope, datasourceSrv, $controller, contextSrv) {
      $scope.init = function () {
        var targetObj = {
          metric: "",
          host: "",
          distance: 300,
        };
        $scope.targetObj = targetObj;
        _.each(datasourceSrv.getAll(), function(ds) {
          if (ds.type === 'opentsdb') {
            datasourceSrv.get(ds.name).then(function(datasource) {
              $scope.datasource = datasource;
            });
          }
        });
      };

      $scope.resetCorrelationAnalysis = function () {
        $scope.targetObj.distance = $scope.thresholdSlider.get();
        $scope.analysis();
      };

      $scope.analysis = function () {
        var associationObj = _.cloneDeep($scope.targetObj);
        associationObj.metric = contextSrv.user.orgId + "." + contextSrv.system + "." + $scope.targetObj.metric;
        $controller('AlertAssociationCtrl', {$scope: $scope}).initPage(associationObj);
        $scope.status = true;
      };

      $scope.getTextValues = function (metricFindResult) {
        return _.map(metricFindResult, function (value) {
          return value.text;
        });
      };

      $scope.suggestMetrics = function (query, callback) {
        $scope.datasource.metricFindQuery('metrics(' + query + ')')
          .then($scope.getTextValues)
          .then(callback);
      };

      $scope.suggestTagValues = function (query, callback) {
        $scope.datasource.metricFindQuery('suggest_tagv(' + query + ')')
          .then($scope.getTextValues)
          .then(callback);
      };

      $scope.init();
    });
  });
