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

      $scope.bucketAggTypes = [
        {text: "Terms",           value: 'terms' },
        {text: "Date Histogram",  value: 'date_histogram' },
      ];

      $scope.$watch("index", function() {
        $scope.isFirst = $scope.index === 0;
        $scope.isLast = $scope.index === bucketAggs.length - 1;
      });

      if ($scope.agg.type === "terms") {
        $scope.aggOptionsString = "Top 5, Order by: sum @value";
      }

      $scope.toggleOptions = function() {
        $scope.showOptions = !$scope.showOptions;
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

      $scope.removeBucketAgg = function() {
        bucketAggs.splice($scope.index, 1);
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
