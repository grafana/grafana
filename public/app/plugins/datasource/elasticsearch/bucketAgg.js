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

    $rootScope.onAppEvent('elastic-query-updated', function() {
      $scope.validateModel();
      $scope.updateOrderByOptions();
    });

    $scope.init = function() {
      $scope.agg = bucketAggs[$scope.index];
      $scope.validateModel();
    };

    $scope.onChangeInternal = function() {
      if ($scope.validateModel()) {
        $scope.onChange();
      }
    };

    $scope.validateModel = function() {
      $scope.index = _.indexOf(bucketAggs, $scope.agg);

      $scope.isFirst = $scope.index === 0;
      $scope.isLast = $scope.index === bucketAggs.length - 1;
      $scope.settingsLinkText = "";

      if ($scope.agg.type === "terms") {
        $scope.agg.order = $scope.agg.order || "asc";
        $scope.agg.size = $scope.agg.size || "0";
        $scope.agg.orderBy = $scope.agg.orderBy || "_term";

        if ($scope.agg.size !== '0') {
          $scope.settingsLinkText = queryDef.describeOrder($scope.agg.order) + ' ' + $scope.agg.size + ', ';
        }

        $scope.settingsLinkText += 'Order by: ' + queryDef.describeOrderBy($scope.agg.orderBy, $scope.target);

        if ($scope.agg.size === '0') {
          $scope.settingsLinkText += ' (' + $scope.agg.order + ')';
        }
      } else if ($scope.agg.type === 'date_histogram') {
        delete $scope.agg.field;
      }

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
