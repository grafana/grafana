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

    $scope.metricAggTypes = queryDef.getMetricAggTypes($scope.esVersion);
    $scope.extendedStats = queryDef.extendedStats;
    $scope.pipelineAggOptions = [];

    $scope.init = function() {
      $scope.agg = metricAggs[$scope.index];
      $scope.validateModel();
      $scope.updatePipelineAggOptions();
    };

    $scope.updatePipelineAggOptions = function() {
      $scope.pipelineAggOptions = queryDef.getPipelineAggOptions($scope.target);
    };

    $rootScope.onAppEvent('elastic-query-updated', function() {
      $scope.index = _.indexOf(metricAggs, $scope.agg);
      $scope.updatePipelineAggOptions();
      $scope.validateModel();
    }, $scope);

    $scope.validateModel = function() {
      $scope.isFirst = $scope.index === 0;
      $scope.isSingle = metricAggs.length === 1;
      $scope.settingsLinkText = '';
      $scope.aggDef = _.findWhere($scope.metricAggTypes, {value: $scope.agg.type});

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

      switch($scope.agg.type) {
        case 'percentiles': {
          $scope.agg.settings.percents = $scope.agg.settings.percents || [25,50,75,95,99];
          $scope.settingsLinkText = 'Values: ' + $scope.agg.settings.percents.join(',');
          break;
        }
        case 'extended_stats': {
          if (_.keys($scope.agg.meta).length === 0)  {
            $scope.agg.meta.std_deviation_bounds_lower = true;
            $scope.agg.meta.std_deviation_bounds_upper = true;
          }

          var stats = _.reduce($scope.agg.meta, function(memo, val, key) {
            if (val) {
              var def = _.findWhere($scope.extendedStats, {value: key});
              memo.push(def.text);
            }
            return memo;
          }, []);

          $scope.settingsLinkText = 'Stats: ' + stats.join(', ');
          break;
        }
        case 'raw_document': {
          $scope.target.metrics = [$scope.agg];
          $scope.target.bucketAggs = [];
          break;
        }
      }

      if ($scope.aggDef.supportsInlineScript) {
        // I know this stores the inline script twice
        // but having it like this simplifes the query_builder
        var inlineScript = $scope.agg.inlineScript;
        if (inlineScript) {
          $scope.agg.settings.script = {inline: inlineScript};
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

    $scope.onTypeChange = function() {
      $scope.agg.settings = {};
      $scope.agg.meta = {};
      $scope.showOptions = false;
      $scope.updatePipelineAggOptions();
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

  });

});
