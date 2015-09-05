define([
  'angular',
  'lodash',
  './queryDef'
],
function (angular, _, queryDef) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.controller('ElasticMetricAggCtrl', function($scope, uiSegmentSrv, $q, $rootScope) {
    var metricAggs = $scope.target.metrics;

    $scope.metricAggTypes = queryDef.metricAggTypes;

    $scope.init = function() {
      $scope.agg = metricAggs[$scope.index];
      $scope.validateModel();
    }

    $rootScope.onAppEvent('elastic-query-updated', function() {
      $scope.index = _.indexOf(metricAggs, $scope.agg);
      $scope.validateModel();
    });

    $scope.validateModel = function() {
      $scope.isFirst = $scope.index === 0;
      $scope.isSingle = metricAggs.length === 1;

      $scope.settingsLinkText = '';

      if (!$scope.agg.field) {
        $scope.agg.field = 'select field';
      }

      switch($scope.agg.type) {
        case 'percentiles': {
          $scope.agg.settings.percents = $scope.agg.settings.percents || [25,50,75,95,99];
          $scope.settingsLinkText = 'values: ' + $scope.agg.settings.percents.join(',');
          break;
        }
        case 'extended_stats': {
          $scope.agg.stats = $scope.agg.stats || ['std_deviation'];
          $scope.settingsLinkText = 'stats: ' + $scope.agg.stats.join(',');
        }
      }
    }

    $scope.toggleOptions = function() {
      $scope.showOptions = !$scope.showOptions;
    };

    $scope.onTypeChange = function() {
      $scope.agg.settings = {};
      $scope.validateModel();
      $scope.onChange();
    };

    $scope.addMetricAgg = function() {
      var addIndex = metricAggs.length;

      var id = _.reduce($scope.target.bucketAggs.concat($scope.target.metrics), function(max, val) {
        return parseInt(val.id) > max ? parseInt(val.id) : max;
      }, 0);

      metricAggs.splice(addIndex, 0, {type: "count", field: "select field", id: (id+1).toString()});
      $scope.onChange();
    };

    $scope.removeMetricAgg = function() {
      metricAggs.splice($scope.index, 1);
      $scope.onChange();
    };

    $scope.init();

  });

});
