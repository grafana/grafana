import coreModule from 'app/core/core_module';
import _ from 'lodash';
import * as queryDef from './query_def';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { CoreEvents } from 'app/types';

export class ElasticBucketAggCtrl {
  /** @ngInject */
  constructor($scope: any, uiSegmentSrv: any, $rootScope: GrafanaRootScope) {
    const bucketAggs = $scope.target.bucketAggs;

    $scope.orderByOptions = [];

    $scope.getBucketAggTypes = () => {
      return queryDef.bucketAggTypes;
    };

    $scope.getOrderOptions = () => {
      return queryDef.orderOptions;
    };

    $scope.getSizeOptions = () => {
      return queryDef.sizeOptions;
    };

    $rootScope.onAppEvent(
      CoreEvents.elasticQueryUpdated,
      () => {
        $scope.validateModel();
      },
      $scope
    );

    $scope.init = () => {
      $scope.agg = bucketAggs[$scope.index];
      $scope.validateModel();
    };

    $scope.onChangeInternal = () => {
      $scope.onChange();
    };

    $scope.onTypeChanged = () => {
      $scope.agg.settings = {};
      $scope.showOptions = false;

      switch ($scope.agg.type) {
        case 'date_histogram':
        case 'histogram':
        case 'terms': {
          delete $scope.agg.query;
          $scope.agg.field = 'select field';
          break;
        }
        case 'filters': {
          delete $scope.agg.field;
          $scope.agg.query = '*';
          break;
        }
        case 'geohash_grid': {
          $scope.agg.settings.precision = 3;
          break;
        }
      }

      $scope.validateModel();
      $scope.onChange();
    };

    $scope.validateModel = () => {
      $scope.index = _.indexOf(bucketAggs, $scope.agg);
      $scope.isFirst = $scope.index === 0;
      $scope.bucketAggCount = bucketAggs.length;

      let settingsLinkText = '';
      const settings = $scope.agg.settings || {};

      switch ($scope.agg.type) {
        case 'terms': {
          settings.order = settings.order || 'desc';
          settings.size = settings.size || '10';
          settings.min_doc_count = settings.min_doc_count || 0;
          settings.orderBy = settings.orderBy || '_term';

          if (settings.size !== '0') {
            settingsLinkText = queryDef.describeOrder(settings.order) + ' ' + settings.size + ', ';
          }

          if (settings.min_doc_count > 0) {
            settingsLinkText += 'Min Doc Count: ' + settings.min_doc_count + ', ';
          }

          settingsLinkText += 'Order by: ' + queryDef.describeOrderBy(settings.orderBy, $scope.target);

          if (settings.size === '0') {
            settingsLinkText += ' (' + settings.order + ')';
          }

          break;
        }
        case 'filters': {
          settings.filters = settings.filters || [{ query: '*' }];
          settingsLinkText = _.reduce(
            settings.filters,
            (memo, value, index) => {
              memo += 'Q' + (index + 1) + '  = ' + value.query + ' ';
              return memo;
            },
            ''
          );
          if (settingsLinkText.length > 50) {
            settingsLinkText = settingsLinkText.substr(0, 50) + '...';
          }
          settingsLinkText = 'Filter Queries (' + settings.filters.length + ')';
          break;
        }
        case 'date_histogram': {
          settings.interval = settings.interval || 'auto';
          settings.min_doc_count = settings.min_doc_count || 0;
          $scope.agg.field = $scope.target.timeField;
          settingsLinkText = 'Interval: ' + settings.interval;

          if (settings.min_doc_count > 0) {
            settingsLinkText += ', Min Doc Count: ' + settings.min_doc_count;
          }

          if (settings.trimEdges === undefined || settings.trimEdges < 0) {
            settings.trimEdges = 0;
          }

          if (settings.trimEdges && settings.trimEdges > 0) {
            settingsLinkText += ', Trim edges: ' + settings.trimEdges;
          }
          break;
        }
        case 'histogram': {
          settings.interval = settings.interval || 1000;
          settings.min_doc_count = _.defaultTo(settings.min_doc_count, 1);
          settingsLinkText = 'Interval: ' + settings.interval;

          if (settings.min_doc_count > 0) {
            settingsLinkText += ', Min Doc Count: ' + settings.min_doc_count;
          }
          break;
        }
        case 'geohash_grid': {
          // limit precision to 12
          settings.precision = Math.max(Math.min(settings.precision, 12), 1);
          settingsLinkText = 'Precision: ' + settings.precision;
          break;
        }
      }

      $scope.settingsLinkText = settingsLinkText;
      $scope.agg.settings = settings;
      return true;
    };

    $scope.addFiltersQuery = () => {
      $scope.agg.settings.filters.push({ query: '*' });
    };

    $scope.removeFiltersQuery = (filter: any) => {
      $scope.agg.settings.filters = _.without($scope.agg.settings.filters, filter);
    };

    $scope.toggleOptions = () => {
      $scope.showOptions = !$scope.showOptions;
    };

    $scope.getOrderByOptions = () => {
      return queryDef.getOrderByOptions($scope.target);
    };

    $scope.getFieldsInternal = () => {
      if ($scope.agg.type === 'date_histogram') {
        return $scope.getFields({ $fieldType: 'date' });
      } else {
        return $scope.getFields();
      }
    };

    $scope.getIntervalOptions = () => {
      return Promise.resolve(uiSegmentSrv.transformToSegments(true, 'interval')(queryDef.intervalOptions));
    };

    $scope.addBucketAgg = () => {
      // if last is date histogram add it before
      const lastBucket = bucketAggs[bucketAggs.length - 1];
      let addIndex = bucketAggs.length - 1;

      if (lastBucket && lastBucket.type === 'date_histogram') {
        addIndex -= 1;
      }

      const id = _.reduce(
        $scope.target.bucketAggs.concat($scope.target.metrics),
        (max, val) => {
          return parseInt(val.id, 10) > max ? parseInt(val.id, 10) : max;
        },
        0
      );

      bucketAggs.splice(addIndex, 0, { type: 'terms', field: 'select field', id: (id + 1).toString(), fake: true });
      $scope.onChange();
    };

    $scope.removeBucketAgg = () => {
      bucketAggs.splice($scope.index, 1);
      $scope.onChange();
    };

    $scope.init();
  }
}

export function elasticBucketAgg() {
  return {
    templateUrl: 'public/app/plugins/datasource/elasticsearch/partials/bucket_agg.html',
    controller: ElasticBucketAggCtrl,
    restrict: 'E',
    scope: {
      target: '=',
      index: '=',
      onChange: '&',
      getFields: '&',
    },
  };
}

coreModule.directive('elasticBucketAgg', elasticBucketAgg);
