import angular from 'angular';
import _ from 'lodash';
import * as queryDef from './query_def';

export function elasticBucketAgg() {
  return {
    templateUrl: 'public/app/plugins/datasource/elasticsearch/partials/bucket_agg.html',
    controller: 'ElasticBucketAggCtrl',
    restrict: 'E',
    scope: {
      target: '=',
      index: '=',
      onChange: '&',
      getFields: '&',
    },
  };
}

export class ElasticBucketAggCtrl {
  /** @nginject */
  constructor($scope, uiSegmentSrv, $q, $rootScope) {
    var bucketAggs = $scope.target.bucketAggs;

    $scope.orderByOptions = [];

    $scope.getBucketAggTypes = function() {
      return queryDef.bucketAggTypes;
    };

    $scope.getOrderOptions = function() {
      return queryDef.orderOptions;
    };

    $scope.getSizeOptions = function() {
      return queryDef.sizeOptions;
    };

    $rootScope.onAppEvent(
      'elastic-query-updated',
      function() {
        $scope.validateModel();
      },
      $scope
    );

    $scope.init = function() {
      $scope.agg = bucketAggs[$scope.index];
      $scope.validateModel();
    };

    $scope.onChangeInternal = function() {
      $scope.onChange();
    };

    $scope.onTypeChanged = function() {
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

    $scope.validateModel = function() {
      $scope.index = _.indexOf(bucketAggs, $scope.agg);
      $scope.isFirst = $scope.index === 0;
      $scope.bucketAggCount = bucketAggs.length;

      var settingsLinkText = '';
      var settings = $scope.agg.settings || {};

      switch ($scope.agg.type) {
        case 'terms': {
          settings.order = settings.order || 'desc';
          settings.size = settings.size || '10';
          settings.min_doc_count = settings.min_doc_count || 1;
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
            function(memo, value, index) {
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
          // limit precision to 7
          settings.precision = Math.max(Math.min(settings.precision, 7), 1);
          settingsLinkText = 'Precision: ' + settings.precision;
          break;
        }
      }

      $scope.settingsLinkText = settingsLinkText;
      $scope.agg.settings = settings;
      return true;
    };

    $scope.addFiltersQuery = function() {
      $scope.agg.settings.filters.push({ query: '*' });
    };

    $scope.removeFiltersQuery = function(filter) {
      $scope.agg.settings.filters = _.without($scope.agg.settings.filters, filter);
    };

    $scope.toggleOptions = function() {
      $scope.showOptions = !$scope.showOptions;
    };

    $scope.getOrderByOptions = function() {
      return queryDef.getOrderByOptions($scope.target);
    };

    $scope.getFieldsInternal = function() {
      if ($scope.agg.type === 'date_histogram') {
        return $scope.getFields({ $fieldType: 'date' });
      } else {
        return $scope.getFields();
      }
    };

    $scope.getIntervalOptions = function() {
      return $q.when(uiSegmentSrv.transformToSegments(true, 'interval')(queryDef.intervalOptions));
    };

    $scope.addBucketAgg = function() {
      // if last is date histogram add it before
      var lastBucket = bucketAggs[bucketAggs.length - 1];
      var addIndex = bucketAggs.length - 1;

      if (lastBucket && lastBucket.type === 'date_histogram') {
        addIndex -= 1;
      }

      var id = _.reduce(
        $scope.target.bucketAggs.concat($scope.target.metrics),
        function(max, val) {
          return parseInt(val.id) > max ? parseInt(val.id) : max;
        },
        0
      );

      bucketAggs.splice(addIndex, 0, { type: 'terms', field: 'select field', id: (id + 1).toString(), fake: true });
      $scope.onChange();
    };

    $scope.removeBucketAgg = function() {
      bucketAggs.splice($scope.index, 1);
      $scope.onChange();
    };

    $scope.init();
  }
}

var module = angular.module('grafana.directives');
module.directive('elasticBucketAgg', elasticBucketAgg);
module.controller('ElasticBucketAggCtrl', ElasticBucketAggCtrl);
