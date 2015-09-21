define([
  'angular',
  'lodash',
  './queryDef',
],
function (angular, _, queryDef) {
  'use strict';

  var module = angular.module('grafana.directives');

  module.controller('ElasticBucketAggCtrl', function($scope, uiSegmentSrv, $q, $rootScope) {
    var bucketAggs = $scope.target.bucketAggs;

    $scope.orderByOptions = [];
    $scope.bucketAggTypes = queryDef.bucketAggTypes;
    $scope.orderOptions = queryDef.orderOptions;
    $scope.sizeOptions = queryDef.sizeOptions;
    $scope.intervalOptions = queryDef.intervalOptions;

    $rootScope.onAppEvent('elastic-query-updated', function() {
      $scope.validateModel();
      $scope.updateOrderByOptions();
    }, $scope);

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

      switch($scope.agg.type) {
        case 'date_histogram':
        case 'terms':  {
          delete $scope.agg.query;
          $scope.agg.type = 'select field';
          break;
        }
        case 'filters': {
          delete $scope.agg.field;
          $scope.agg.query = '*';
          break;
        }
      }

      $scope.validateModel();
      $scope.onChange();
    };

    $scope.validateModel = function() {
      $scope.index = _.indexOf(bucketAggs, $scope.agg);
      $scope.isFirst = $scope.index === 0;
      $scope.isLast = $scope.index === bucketAggs.length - 1;

      var settingsLinkText = "";
      var settings = $scope.agg.settings || {};

      switch($scope.agg.type) {
        case 'terms': {
          settings.order = settings.order || "asc";
          settings.size = settings.size || "0";
          settings.orderBy = settings.orderBy || "_term";

          if (settings.size !== '0') {
            settingsLinkText = queryDef.describeOrder(settings.order) + ' ' + settings.size + ', ';
          }

          settingsLinkText += 'Order by: ' + queryDef.describeOrderBy(settings.orderBy, $scope.target);

          if (settings.size === '0') {
            settingsLinkText += ' (' + settings.order + ')';
          }

          break;
        }
        case 'filters': {
          break;
        }
        case 'date_histogram': {
          settings.interval = settings.interval || 'auto';
          $scope.agg.field = $scope.target.timeField;
          settingsLinkText = 'Interval: ' + settings.interval;
        }
      }

      $scope.settingsLinkText = settingsLinkText;
      $scope.agg.settings = settings;
      return true;
    };

    $scope.toggleOptions = function() {
      $scope.showOptions = !$scope.showOptions;
      $scope.updateOrderByOptions();
    };

    $scope.updateOrderByOptions = function() {
      $scope.orderByOptions = queryDef.getOrderByOptions($scope.target);
    };

    $scope.addBucketAgg = function() {
      // if last is date histogram add it before
      var lastBucket = bucketAggs[bucketAggs.length - 1];
      var addIndex = bucketAggs.length - 1;

      if (lastBucket && lastBucket.type === 'date_histogram') {
        addIndex - 1;
      }

      var id = _.reduce($scope.target.bucketAggs.concat($scope.target.metrics), function(max, val) {
        return parseInt(val.id) > max ? parseInt(val.id) : max;
      }, 0);

      bucketAggs.splice(addIndex, 0, {type: "terms", field: "select field", id: (id+1).toString()});
      $scope.onChange();
    };

    $scope.removeBucketAgg = function() {
      bucketAggs.splice($scope.index, 1);
      $scope.onChange();
    };

    $scope.init();

  });

});
