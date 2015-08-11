define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('CloudWatchQueryCtrl', function($scope) {

    $scope.init = function() {
      $scope.target.namespace = $scope.target.namespace || '';
      $scope.target.metricName = $scope.target.metricName || '';
      $scope.target.dimensions = $scope.target.dimensions || {};
      $scope.target.statistics = $scope.target.statistics || {};
      $scope.target.period = $scope.target.period || 60;
      $scope.target.region = $scope.target.region || $scope.datasource.getDefaultRegion();

      $scope.target.errors = validateTarget();
    };

    $scope.refreshMetricData = function() {
      $scope.target.errors = validateTarget($scope.target);

      // this does not work so good
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };

    $scope.moveMetricQuery = function(fromIndex, toIndex) {
      _.move($scope.panel.targets, fromIndex, toIndex);
    };

    $scope.duplicate = function() {
      var clone = angular.copy($scope.target);
      $scope.panel.targets.push(clone);
    };

    $scope.suggestRegion = function(query, callback) { // jshint unused:false
      return $scope.datasource.performSuggestRegion();
    };

    $scope.suggestNamespace = function(query, callback) { // jshint unused:false
      return $scope.datasource.performSuggestNamespace();
    };

    $scope.suggestMetrics = function(query, callback) { // jshint unused:false
      return $scope.datasource.performSuggestMetrics($scope.target.namespace);
    };

    $scope.suggestDimensionKeys = function(query, callback) { // jshint unused:false
      return $scope.datasource.performSuggestDimensionKeys($scope.target.namespace);
    };

    $scope.suggestDimensionValues = function(query, callback) {
      if (!$scope.target.namespace || !$scope.target.metricName) {
        return callback([]);
      }

      $scope.datasource.performSuggestDimensionValues(
        $scope.target.region,
        $scope.target.namespace,
        $scope.target.metricName,
        $scope.target.dimensions,
        $scope.target.currentDimensionKey
      )
      .then(function(result) {
        callback(result);
      }, function() {
        callback([]);
      });
    };

    $scope.addDimension = function() {
      if (!$scope.addDimensionMode) {
        $scope.addDimensionMode = true;
        return;
      }

      if (!$scope.target.dimensions) {
        $scope.target.dimensions = {};
      }

      $scope.target.dimensions[$scope.target.currentDimensionKey] = $scope.target.currentDimensionValue;
      $scope.target.currentDimensionKey = '';
      $scope.target.currentDimensionValue = '';
      $scope.refreshMetricData();

      $scope.addDimensionMode = false;
    };

    $scope.removeDimension = function(key) {
      delete $scope.target.dimensions[key];
      $scope.refreshMetricData();
    };

    $scope.statisticsOptionChanged = function() {
      $scope.refreshMetricData();
    };

    // TODO: validate target
    function validateTarget() {
      var errs = {};

      if ($scope.target.period < 60 || ($scope.target.period % 60) !== 0) {
        errs.period = 'Period must be at least 60 seconds and must be a multiple of 60';
      }

      return errs;
    }

  });

});
