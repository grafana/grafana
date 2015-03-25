define([
  'angular',
  'lodash',
  'kbn'
],
function (angular, _, kbn) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('OpenTSDBQueryCtrl', function($scope) {

    $scope.init = function() {
      $scope.target.errors = validateTarget($scope.target);
      $scope.aggregators = ['avg', 'sum', 'min', 'max', 'dev', 'zimsum', 'mimmin', 'mimmax'];

      $scope.datasource.performAggregatorsQuery().then(function(result) {
        if (result) {
          $scope.aggregators = result;
        }
      });

      if (!$scope.target.aggregator) {
        $scope.target.aggregator = 'sum';
      }

      if (!$scope.target.downsampleAggregator) {
        $scope.target.downsampleAggregator = 'avg';
      }

      $scope.datasource.getAggregators().then(function(aggs) {
        $scope.aggregators = aggs;
      });
    };

    $scope.targetBlur = function() {
      $scope.target.errors = validateTarget($scope.target);

      // this does not work so good
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
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
      $scope.datasource.metricFindQuery('tag_names(' + $scope.target.metric + ')')
        .then($scope.getTextValues)
        .then(callback);
    };

    $scope.suggestTagValues = function(query, callback) {
      $scope.datasource.metricFindQuery('tag_values(' + $scope.target.metric + ',' + $scope.target.currentTagKey + ')')
        .then($scope.getTextValues)
        .then(callback);
    };

    $scope.addTag = function() {
      if (!$scope.addTagMode) {
        $scope.addTagMode = true;
        return;
      }

      if (!$scope.target.tags) {
        $scope.target.tags = {};
      }

      $scope.target.errors = validateTarget($scope.target);

      if (!$scope.target.errors.tags) {
        $scope.target.tags[$scope.target.currentTagKey] = $scope.target.currentTagValue;
        $scope.target.currentTagKey = '';
        $scope.target.currentTagValue = '';
        $scope.targetBlur();
      }

      $scope.addTagMode = false;
    };

    $scope.removeTag = function(key) {
      delete $scope.target.tags[key];
      $scope.targetBlur();
    };

    function validateTarget(target) {
      var errs = {};

      if (target.shouldDownsample) {
        try {
          if (target.downsampleInterval) {
            kbn.describe_interval(target.downsampleInterval);
          } else {
            errs.downsampleInterval = "You must supply a downsample interval (e.g. '1m' or '1h').";
          }
        } catch(err) {
          errs.downsampleInterval = err.message;
        }
      }

      if (target.tags && _.has(target.tags, target.currentTagKey)) {
        errs.tags = "Duplicate tag key '" + target.currentTagKey + "'.";
      }

      return errs;
    }

    $scope.init();
  });

});
