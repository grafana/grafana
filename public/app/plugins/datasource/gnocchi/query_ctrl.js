define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('GnocchiQueryCtrl', function($scope, $timeout) {

    $scope.init = function() {
      // TODO(sileht): Allows custom
      $scope.aggregators = ['mean', 'sum', 'min', 'max',
                            'std', 'median', 'first', 'last', 'count'].concat(
                                _.range(1, 100).map(function (i) { return i + "pct"; }));

      if (!$scope.target.aggregator) {
        $scope.target.aggregator = 'mean';
      }

      $scope.$on('typeahead-updated', function() {
        $timeout($scope.targetBlur);
      });

      if (!$scope.target.queryMode) {
        $scope.target.queryMode = "resource_search";
      }
      $scope.target.error = $scope.datasource.validateTarget($scope.target);
    };

    $scope.suggestMetricIDs = function(query, callback) {
      $scope.datasource
        .performSuggestQuery(query, 'metrics', $scope.target)
        .then(callback);
    };

    $scope.suggestResourceIDs = function(query, callback) {
      $scope.datasource
        .performSuggestQuery(query, 'resources', $scope.target)
        .then(callback);
    };

    $scope.suggestMetricNames = function(query, callback) {
      $scope.datasource
        .performSuggestQuery(query, 'metric_names', $scope.target)
        .then(callback);
    };

    $scope.targetBlur = function() {
      $scope.target.error = $scope.datasource.validateTarget($scope.target);

      // this does not work so good
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.error)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };

    $scope.toggleQueryMode = function () {
      var mode = [
        "resource_search", "resource_aggregation",
        "resource", "metric",
      ];
      var index = mode.indexOf($scope.target.queryMode) + 1;
      if (index === mode.length) {
        index = 0;
      }
      $scope.target.queryMode = mode[index];
    };

  });
});
