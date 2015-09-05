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

      $scope.bucketAggTypes = [
        {text: "Terms",           value: 'terms' },
        {text: "Date Histogram",  value: 'date_histogram' },
      ];

      $scope.orderOptions = [
        {text: "Top",     value: 'desc' },
        {text: "Bottom",  value: 'asc' },
      ];

      $scope.sizeOptions = [
        {text: "No limit", value: '0' },
        {text: "1", value: '1' },
        {text: "2", value: '2' },
        {text: "3", value: '4' },
        {text: "5", value: '5' },
        {text: "10", value: '10' },
        {text: "15", value: '15' },
        {text: "20", value: '20' },
      ];

      $scope.$watch("index", function() {
        $scope.isFirst = $scope.index === 0;
        $scope.isLast = $scope.index === bucketAggs.length - 1;
      });

      $scope.init = function() {
        $scope.agg = bucketAggs[$scope.index];
        $scope.modelIsValid();
      };

      $scope.onChangeInternal = function() {
        if ($scope.modelIsValid()) {
          $scope.onChange();
        }
      };

      $scope.modelIsValid = function() {
        if ($scope.agg.type === "terms") {
          $scope.aggOptionsString = "Top 5, Order by: sum @value";

          $scope.agg.order = $scope.agg.order || "desc";
          $scope.agg.size = $scope.agg.size || "0";
          $scope.agg.orderBy = $scope.agg.orderBy || "_count";
        }
        return true;
      };

      $scope.toggleOptions = function() {
        $scope.showOptions = !$scope.showOptions;

        $scope.orderByOptions = [
          {text: "Doc Count", value: '_count' },
          {text: "Term name", value: '_term' },
          {text: "Average of @value", value: '1' },
        ];
      }

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
      };

      $scope.removeBucketAgg = function() {
        bucketAggs.splice($scope.index, 1);
        $scope.onChange();
      };

      $scope.init();

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
