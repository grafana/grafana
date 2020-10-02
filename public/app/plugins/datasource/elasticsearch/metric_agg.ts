import coreModule from 'app/core/core_module';
import _ from 'lodash';
import * as queryDef from './query_def';
import { ElasticsearchAggregation } from './types';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { CoreEvents } from 'app/types';

export class ElasticMetricAggCtrl {
  /** @ngInject */
  constructor($scope: any, uiSegmentSrv: any, $rootScope: GrafanaRootScope) {
    const metricAggs: ElasticsearchAggregation[] = $scope.target.metrics;
    $scope.metricAggTypes = queryDef.getMetricAggTypes($scope.esVersion);
    $scope.extendedStats = queryDef.extendedStats;
    $scope.pipelineAggOptions = [];
    $scope.modelSettingsValues = {};

    $scope.init = () => {
      $scope.agg = metricAggs[$scope.index];
      $scope.validateModel();
      $scope.updatePipelineAggOptions();
    };

    $scope.updatePipelineAggOptions = () => {
      $scope.pipelineAggOptions = queryDef.getPipelineAggOptions($scope.target);
    };

    $rootScope.onAppEvent(
      CoreEvents.elasticQueryUpdated,
      () => {
        $scope.index = _.indexOf(metricAggs, $scope.agg);
        $scope.updatePipelineAggOptions();
        $scope.validateModel();
      },
      $scope
    );

    $scope.validateModel = () => {
      $scope.isFirst = $scope.index === 0;
      $scope.isSingle = metricAggs.length === 1;
      $scope.settingsLinkText = '';
      $scope.variablesLinkText = '';
      $scope.aggDef = _.find($scope.metricAggTypes, { value: $scope.agg.type });

      if (queryDef.isPipelineAgg($scope.agg.type)) {
        if (queryDef.isPipelineAggWithMultipleBucketPaths($scope.agg.type)) {
          $scope.variablesLinkText = 'Options';

          if ($scope.agg.settings.script) {
            $scope.variablesLinkText = 'Script: ' + $scope.agg.settings.script.replace(new RegExp('params.', 'g'), '');
          }
        } else {
          $scope.agg.pipelineAgg = $scope.agg.pipelineAgg || 'select metric';
          $scope.agg.field = $scope.agg.pipelineAgg;
        }

        const pipelineOptions = queryDef.getPipelineOptions($scope.agg);
        if (pipelineOptions.length > 0) {
          _.each(pipelineOptions, opt => {
            $scope.agg.settings[opt.text] = $scope.agg.settings[opt.text] || opt.default;
          });
          $scope.settingsLinkText = 'Options';
        }
      } else if (!$scope.agg.field) {
        $scope.agg.field = 'select field';
      }
      switch ($scope.agg.type) {
        case 'cardinality': {
          const precisionThreshold = $scope.agg.settings.precision_threshold || '';
          $scope.settingsLinkText = 'Precision threshold: ' + precisionThreshold;
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

          const stats = _.reduce(
            $scope.agg.meta,
            (memo, val, key) => {
              if (val) {
                const def: any = _.find($scope.extendedStats, { value: key });
                memo.push(def.text);
              }
              return memo;
            },
            [] as string[]
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
        case 'raw_document':
        case 'raw_data': {
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
        const inlineScript = $scope.agg.inlineScript;
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

    $scope.toggleOptions = () => {
      $scope.showOptions = !$scope.showOptions;
      $scope.updatePipelineAggOptions();
    };

    $scope.toggleVariables = () => {
      $scope.showVariables = !$scope.showVariables;
    };

    $scope.onChangeInternal = () => {
      $scope.onChange();
    };

    $scope.updateMovingAvgModelSettings = () => {
      const modelSettingsKeys = [];
      const modelSettings = queryDef.getMovingAvgSettings($scope.agg.settings.model, false);
      for (let i = 0; i < modelSettings.length; i++) {
        modelSettingsKeys.push(modelSettings[i].value);
      }

      for (const key in $scope.agg.settings.settings) {
        if ($scope.agg.settings.settings[key] === null || modelSettingsKeys.indexOf(key) === -1) {
          delete $scope.agg.settings.settings[key];
        }
      }
    };

    $scope.onChangeClearInternal = () => {
      delete $scope.agg.settings.minimize;
      $scope.onChange();
    };

    $scope.onTypeChange = () => {
      $scope.agg.settings = {};
      $scope.agg.meta = {};
      $scope.showOptions = false;

      // reset back to metric/group by query
      if (
        $scope.target.bucketAggs.length === 0 &&
        ($scope.agg.type !== 'raw_document' || $scope.agg.type !== 'raw_data')
      ) {
        $scope.target.bucketAggs = [queryDef.defaultBucketAgg()];
      }

      $scope.showVariables = queryDef.isPipelineAggWithMultipleBucketPaths($scope.agg.type);
      $scope.updatePipelineAggOptions();
      $scope.onChange();
    };

    $scope.getFieldsInternal = () => {
      if ($scope.agg.type === 'cardinality') {
        return $scope.getFields();
      }
      return $scope.getFields({ $fieldType: 'number' });
    };

    $scope.addMetricAgg = () => {
      const addIndex = metricAggs.length;

      const id = _.reduce(
        $scope.target.bucketAggs.concat($scope.target.metrics),
        (max, val) => {
          return parseInt(val.id, 10) > max ? parseInt(val.id, 10) : max;
        },
        0
      );

      metricAggs.splice(addIndex, 0, { type: 'count', field: 'select field', id: (id + 1).toString() });
      $scope.onChange();
    };

    $scope.removeMetricAgg = () => {
      metricAggs.splice($scope.index, 1);
      $scope.onChange();
    };

    $scope.toggleShowMetric = () => {
      $scope.agg.hide = !$scope.agg.hide;
      if (!$scope.agg.hide) {
        delete $scope.agg.hide;
      }
      $scope.onChange();
    };

    $scope.init();
  }
}

export function elasticMetricAgg() {
  return {
    templateUrl: 'public/app/plugins/datasource/elasticsearch/partials/metric_agg.html',
    controller: ElasticMetricAggCtrl,
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

coreModule.directive('elasticMetricAgg', elasticMetricAgg);
