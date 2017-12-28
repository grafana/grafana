import angular from 'angular';
import _ from 'lodash';
import * as queryDef from './query_def';

export function elasticMetricAgg() {
  return {
    templateUrl: 'public/app/plugins/datasource/elasticsearch/partials/metric_agg.html',
    controller: 'ElasticMetricAggCtrl',
    restrict: 'E',
    scope: {
      target: '=',
      index: '=',
      onChange: '&',
      getFields: '&',
      esVersion: '=',
    },
  };
}

export class ElasticMetricAggCtrl {
  constructor($scope, uiSegmentSrv, $q, $rootScope) {
    var metricAggs = $scope.target.metrics;
    $scope.metricAggTypes = queryDef.getMetricAggTypes($scope.esVersion);
    $scope.extendedStats = queryDef.extendedStats;
    $scope.pipelineAggOptions = [];
    $scope.modelSettingsValues = {};

    $scope.init = function() {
      $scope.agg = metricAggs[$scope.index];
      $scope.validateModel();
      $scope.updatePipelineAggOptions();
    };

    $scope.updatePipelineAggOptions = function() {
      $scope.pipelineAggOptions = queryDef.getPipelineAggOptions($scope.target);
    };

    $rootScope.onAppEvent(
      'elastic-query-updated',
      function() {
        $scope.index = _.indexOf(metricAggs, $scope.agg);
        $scope.updatePipelineAggOptions();
        $scope.validateModel();
      },
      $scope
    );

    $scope.validateModel = function() {
      $scope.isFirst = $scope.index === 0;
      $scope.isSingle = metricAggs.length === 1;
      $scope.settingsLinkText = '';
      $scope.aggDef = _.find($scope.metricAggTypes, { value: $scope.agg.type });

      if (queryDef.isPipelineAgg($scope.agg.type)) {
        $scope.agg.pipelineAgg = $scope.agg.pipelineAgg || 'select metric';
        $scope.agg.field = $scope.agg.pipelineAgg;

        var pipelineOptions = queryDef.getPipelineOptions($scope.agg);
        if (pipelineOptions.length > 0) {
          _.each(pipelineOptions, function(opt) {
            $scope.agg.settings[opt.text] = $scope.agg.settings[opt.text] || opt.default;
          });
          $scope.settingsLinkText = 'Options';
        }
      } else if (!$scope.agg.field) {
        $scope.agg.field = 'select field';
      }
      switch ($scope.agg.type) {
        case 'cardinality': {
          var precision_threshold = $scope.agg.settings.precision_threshold || '';
          $scope.settingsLinkText = 'Precision threshold: ' + precision_threshold;
          break;
        }
        case 'percentiles': {
          $scope.agg.settings.percents = $scope.agg.settings.percents || [25, 50, 75, 95, 99];
          $scope.settingsLinkText = 'Values: ' + $scope.agg.settings.percents.join(',');
          break;
        }
        case 'extended_stats': {
          if (_.keys($scope.agg.meta).length === 0) {
            $scope.agg.meta.std_deviation_bounds_lower = true;
            $scope.agg.meta.std_deviation_bounds_upper = true;
          }

          var stats = _.reduce(
            $scope.agg.meta,
            function(memo, val, key) {
              if (val) {
                var def = _.find($scope.extendedStats, { value: key });
                memo.push(def.text);
              }
              return memo;
            },
            []
          );

          $scope.settingsLinkText = 'Stats: ' + stats.join(', ');
          break;
        }
        case 'moving_avg': {
          $scope.movingAvgModelTypes = queryDef.movingAvgModelOptions;
          $scope.modelSettings = queryDef.getMovingAvgSettings($scope.agg.settings.model, true);
          $scope.updateMovingAvgModelSettings();
          break;
        }
        case 'raw_document': {
          $scope.agg.settings.size = $scope.agg.settings.size || 500;
          $scope.settingsLinkText = 'Size: ' + $scope.agg.settings.size;
          $scope.target.metrics.splice(0, $scope.target.metrics.length, $scope.agg);

          $scope.target.bucketAggs = [];
          break;
        }
      }
      if ($scope.aggDef.supportsInlineScript) {
        // I know this stores the inline script twice
        // but having it like this simplifes the query_builder
        var inlineScript = $scope.agg.inlineScript;
        if (inlineScript) {
          $scope.agg.settings.script = { inline: inlineScript };
        } else {
          delete $scope.agg.settings.script;
        }

        if ($scope.settingsLinkText === '') {
          $scope.settingsLinkText = 'Options';
        }
      }
    };

    $scope.toggleOptions = function() {
      $scope.showOptions = !$scope.showOptions;
      $scope.updatePipelineAggOptions();
    };

    $scope.onChangeInternal = function() {
      $scope.onChange();
    };

    $scope.updateMovingAvgModelSettings = function() {
      var modelSettingsKeys = [];
      var modelSettings = queryDef.getMovingAvgSettings($scope.agg.settings.model, false);
      for (var i = 0; i < modelSettings.length; i++) {
        modelSettingsKeys.push(modelSettings[i].value);
      }

      for (var key in $scope.agg.settings.settings) {
        if ($scope.agg.settings.settings[key] === null || modelSettingsKeys.indexOf(key) === -1) {
          delete $scope.agg.settings.settings[key];
        }
      }
    };

    $scope.onChangeClearInternal = function() {
      delete $scope.agg.settings.minimize;
      $scope.onChange();
    };

    $scope.onTypeChange = function() {
      $scope.agg.settings = {};
      $scope.agg.meta = {};
      $scope.showOptions = false;
      $scope.updatePipelineAggOptions();
      $scope.onChange();
    };

    $scope.getFieldsInternal = function() {
      if ($scope.agg.type === 'cardinality') {
        return $scope.getFields();
      }
      return $scope.getFields({ $fieldType: 'number' });
    };

    $scope.addMetricAgg = function() {
      var addIndex = metricAggs.length;

      var id = _.reduce(
        $scope.target.bucketAggs.concat($scope.target.metrics),
        function(max, val) {
          return parseInt(val.id) > max ? parseInt(val.id) : max;
        },
        0
      );

      metricAggs.splice(addIndex, 0, { type: 'count', field: 'select field', id: (id + 1).toString() });
      $scope.onChange();
    };

    $scope.removeMetricAgg = function() {
      metricAggs.splice($scope.index, 1);
      $scope.onChange();
    };

    $scope.toggleShowMetric = function() {
      $scope.agg.hide = !$scope.agg.hide;
      if (!$scope.agg.hide) {
        delete $scope.agg.hide;
      }
      $scope.onChange();
    };

    $scope.init();
  }
}

var module = angular.module('grafana.directives');
module.directive('elasticMetricAgg', elasticMetricAgg);
module.controller('ElasticMetricAggCtrl', ElasticMetricAggCtrl);
