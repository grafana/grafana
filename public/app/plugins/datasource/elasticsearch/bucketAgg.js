define([
  'angular',
  'lodash',
  'jquery',
],
function (angular, _, $) {
  'use strict';

  var module = angular.module('grafana.directives');

    module.controller('ElasticBucketAggCtrl', function($scope, uiSegmentSrv, $q) {
      var bucketAggs = $scope.target.bucketAggs;

      $scope.agg = bucketAggs[$scope.index];

      $scope.$watch("index", function() {
        $scope.isFirst = $scope.index === 0;
        $scope.isLast = $scope.index === bucketAggs.length - 1;
      });

      if ($scope.agg.type === "terms") {
        $scope.aggOptionsString = "Top 5, Order by: sum @value";
      }

      $scope.typeSegment = uiSegmentSrv.newSegment($scope.agg.type);
      $scope.fieldSegment = uiSegmentSrv.newSegment($scope.agg.field);

      $scope.getBucketAggTypes = function() {
        return $q.when([
          uiSegmentSrv.newSegment({value: 'terms'}),
          uiSegmentSrv.newSegment({value: 'date_histogram'}),
        ]);
      };

      $scope.toggleOptions = function() {
        $scope.showOptions = $scope.showOptions;
      }

      $scope.addBucketAgg = function() {
        // if last is date histogram add it before
        var lastBucket = bucketAggs[bucketAggs.length - 1];
        var addIndex = bucketAggs.length - 1;

        if (lastBucket && lastBucket.type === 'date_histogram') {
          addIndex - 1;
        }

        bucketAggs.splice(addIndex, 0, {type: "terms", field: "select field" });
      };

      $scope.removeBucketAgg = function(index) {
        bucketAggs.splice(index, 1);
        $scope.onChange();
      };

      $scope.fieldChanged = function() {
        $scope.agg.showOptions = true;
        $scope.agg.field = $scope.fieldSegment.value;
        $scope.onChange();
      };

      $scope.bucketAggTypeChanged = function() {
        $scope.agg.type = $scope.typeSegment.value;
        $scope.onChange();
      };
    });

    module.directive('elasticBucketAgg', function() {
      return {
        templateUrl: 'app/plugins/datasource/elasticsearch/partials/bucketAgg.html',
        controller: 'ElasticBucketAggCtrl',
        restrict: 'E',
        scope: {
          target: "=",
          index: "=",
          onChange: "&",
          getFields: "&",
        },
        link: function postLink($scope, elem) {
        }
      };
    });
});
