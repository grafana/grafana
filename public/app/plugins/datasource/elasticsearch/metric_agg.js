define([
  'angular',
  'lodash',
  './query_def'
],
function (angular, _, queryDef) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.controller('ElasticMetricAggCtrl', function($scope, uiSegmentSrv, $q, $rootScope) {
    var metricAggs = $scope.target.metrics;

    $scope.metricAggTypes = queryDef.metricAggTypes;
    $scope.extendedStats = queryDef.extendedStats;
    $scope.mavgSourceOptions = [];

    $scope.init = function() {
      $scope.agg = metricAggs[$scope.index];
      $scope.validateModel();
    };

    $rootScope.onAppEvent('elastic-query-updated', function() {
      $scope.index = _.indexOf(metricAggs, $scope.agg);
      $scope.validateModel();
      $scope.updateMovingAverageOptions();
    }, $scope);

    $scope.validateModel = function() {
      $scope.isFirst = $scope.index === 0;
      $scope.isSingle = metricAggs.length === 1;
      $scope.settingsLinkText = '';
      $scope.aggDef = _.findWhere($scope.metricAggTypes, {value: $scope.agg.type});

      if (!$scope.agg.field) {
        $scope.agg.field = 'select field';
      }

      switch($scope.agg.type) {
        case 'moving_avg': {
          $scope.agg.mavgSource = $scope.agg.mavgSource || '';
          $scope.settingsLinkText = 'Moving average options';
          break;
        }
        case 'percentiles': {
          $scope.agg.settings.percents = $scope.agg.settings.percents || [25,50,75,95,99];
          $scope.settingsLinkText = 'values: ' + $scope.agg.settings.percents.join(',');
          break;
        }
        case 'extended_stats': {
          var stats = _.reduce($scope.agg.meta, function(memo, val, key) {
            if (val) {
              var def = _.findWhere($scope.extendedStats, {value: key});
              memo.push(def.text);
            }
            return memo;
          }, []);
          $scope.settingsLinkText = 'Stats: ' + stats.join(', ');

          if (stats.length === 0)  {
            $scope.agg.meta.std_deviation_bounds_lower = true;
            $scope.agg.meta.std_deviation_bounds_upper = true;
          }
          break;
        }
        case 'raw_document': {
          $scope.target.metrics = [$scope.agg];
          $scope.target.bucketAggs = [];
        }
      }
    };

    $scope.toggleOptions = function() {
      $scope.showOptions = !$scope.showOptions;
      $scope.updateMovingAverageOptions();
    };

    $scope.onChangeInternal = function() {
      $scope.onChange();
    };

    $scope.onTypeChange = function() {
      $scope.agg.settings = {};
      $scope.agg.meta = {};
      $scope.showOptions = false;
      $scope.onChange();
    };

    $scope.getFieldsInternal = function() {
      return $scope.getFields({$fieldType: 'number'});
    };

    $scope.addMetricAgg = function() {
      var addIndex = metricAggs.length;

      var id = _.reduce($scope.target.bucketAggs.concat($scope.target.metrics), function(max, val) {
        return parseInt(val.id) > max ? parseInt(val.id) : max;
      }, 0);

      metricAggs.splice(addIndex, 0, {type: "count", field: "select field", id: (id+1).toString()});
      $scope.onChange();
    };

    $scope.updateMovingAverageOptions = function() {
      $scope.mvagSourceOptions = queryDef.getMovingAverageSourceOptions($scope.target);
    };

    $scope.removeMetricAgg = function() {
      metricAggs.splice($scope.index, 1);
      $scope.onChange();
    };

    $scope.init();

  });

});
