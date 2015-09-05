define([
  'angular',
  'lodash',
  './queryBuilder',
],
function (angular, _, ElasticQueryBuilder) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ElasticQueryCtrl', function($scope, $timeout, uiSegmentSrv, templateSrv, $q) {

    $scope.init = function() {
      var target = $scope.target;
      if (!target) { return; }

      target.timeField = target.timeField || '@timestamp';
      target.metrics = target.metrics || [{ type: 'count', id: '1' }];
      target.bucketAggs = target.bucketAggs || [];
      target.bucketAggs = [
        {
          type: 'terms',
          field: '@hostname',
          id: '2'
        },
        {
          type: 'date_histogram',
          field: '@timestamp',
          id: '3'
        },
      ];

      $scope.timeSegment = uiSegmentSrv.newSegment(target.timeField);

      $scope.removeSelectSegment = uiSegmentSrv.newSegment({fake: true, value: '-- remove select --'});
      $scope.resetSelectSegment = uiSegmentSrv.newSegment({fake: true, value: '-- reset --'});

      $scope.queryBuilder = new ElasticQueryBuilder(target);
      $scope.rawQueryOld = angular.toJson($scope.queryBuilder.build($scope.target), true);
    };

    $scope.getFields = function() {
      return $scope.datasource.metricFindQuery('fields()')
      .then($scope.transformToSegments(false))
      .then(null, $scope.handleQueryError);
    };

    $scope.queryUpdated = function() {
      console.log('qery updated');
      var newJson = angular.toJson($scope.queryBuilder.build($scope.target), true);
      if (newJson !== $scope.oldQueryRaw) {
        $scope.rawQueryOld = newJson;
        $scope.get_data();
      }
    };

    $scope.transformToSegments = function(addTemplateVars) {
      return function(results) {
        var segments = _.map(results, function(segment) {
          return uiSegmentSrv.newSegment({ value: segment.text, expandable: segment.expandable });
        });

        if (addTemplateVars) {
          _.each(templateSrv.variables, function(variable) {
            segments.unshift(uiSegmentSrv.newSegment({ type: 'template', value: '$' + variable.name, expandable: true }));
          });
        }

        return segments;
      };
    };

    $scope.handleQueryError = function(err) {
      $scope.parserError = err.message || 'Failed to issue metric query';
      return [];
    };

    $scope.toggleQueryMode = function () {
      if ($scope.target.rawQuery) {
        delete $scope.target.rawQuery;
      } else {
        $scope.target.rawQuery = $scope.rawQueryOld;
      }
    };

    $scope.init();

  });

});
