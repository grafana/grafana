define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('CloudWatchQueryCtrl', function($scope, templateSrv) {

    $scope.init = function() {
      $scope.target.namespace = $scope.target.namespace || '';
      $scope.target.metricName = $scope.target.metricName || '';
      $scope.target.dimensions = $scope.target.dimensions || {};
      $scope.target.escapedDimensions = this.escapeDimensions($scope.target.dimensions);
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
      return _.union($scope.datasource.performSuggestRegion(), $scope.datasource.getTemplateVariableNames());
    };

    $scope.suggestNamespace = function(query, callback) { // jshint unused:false
      return _.union($scope.datasource.performSuggestNamespace(), $scope.datasource.getTemplateVariableNames());
    };

    $scope.suggestMetrics = function(query, callback) { // jshint unused:false
      return _.union($scope.datasource.performSuggestMetrics($scope.target.namespace), $scope.datasource.getTemplateVariableNames());
    };

    $scope.suggestDimensionKeys = function(query, callback) { // jshint unused:false
      return _.union($scope.datasource.performSuggestDimensionKeys($scope.target.namespace), $scope.datasource.getTemplateVariableNames());
    };

    $scope.suggestDimensionValues = function(query, callback) {
      if (!$scope.target.namespace || !$scope.target.metricName) {
        return callback([]);
      }

      $scope.datasource.performSuggestDimensionValues(
        $scope.target.region,
        $scope.target.namespace,
        $scope.target.metricName,
        $scope.target.dimensions
      )
      .then(function(result) {
        var suggestData = _.chain(result)
        .flatten(true)
        .filter(function(dimension) {
          return dimension.Name === templateSrv.replace($scope.target.currentDimensionKey);
        })
        .pluck('Value')
        .uniq()
        .value();

        suggestData = _.union(suggestData, $scope.datasource.getTemplateVariableNames());
        callback(suggestData);
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
      $scope.target.escapedDimensions = this.escapeDimensions($scope.target.dimensions);
      $scope.target.currentDimensionKey = '';
      $scope.target.currentDimensionValue = '';
      $scope.refreshMetricData();

      $scope.addDimensionMode = false;
    };

    $scope.removeDimension = function(key) {
      key = key.replace(/\\\$/g, '$');
      delete $scope.target.dimensions[key];
      $scope.target.escapedDimensions = this.escapeDimensions($scope.target.dimensions);
      $scope.refreshMetricData();
    };

    $scope.escapeDimensions = function(d) {
      var result = {};
      _.chain(d)
      .keys(d)
      .each(function(k) {
        var v = d[k];
        result[k.replace(/\$/g, '\\$')] = v.replace(/\$/g, '\\$');
      });

      return result;
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
