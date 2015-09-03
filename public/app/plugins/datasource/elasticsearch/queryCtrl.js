define([
  'angular',
  'lodash',
  './queryBuilder',
],
function (angular, _, ElasticQueryBuilder) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ElasticQueryCtrl', function($scope, $timeout, uiSegmentSrv, templateSrv, $q) {

    $scope.functionList = ['count', 'min', 'max', 'total', 'mean'];

    $scope.functionMenu = _.map($scope.functionList, function(func) {
      return { text: func, click: "changeFunction('" + func + "');" };
    });

    $scope.init = function() {
      $scope.queryBuilder = new ElasticQueryBuilder(target);

      var target = $scope.target;
      target.function = target.function || 'mean';
      target.timeField = target.timeField || '@timestamp';
      target.select = target.select || [{ agg: 'count' }];
      target.groupByFields = target.groupByFields || [];

      $scope.timeSegment = uiSegmentSrv.newSegment(target.timeField);

      $scope.groupBySegments = _.map(target.groupByFields, function(group) {
        return uiSegmentSrv.newSegment(group.field);
      });

      $scope.selectSegments = _.map(target.select, function(select) {
        return uiSegmentSrv.newSegment(select.agg);
      });

      $scope.groupBySegments.push(uiSegmentSrv.newPlusButton());
      $scope.removeSelectSegment = uiSegmentSrv.newSegment({fake: true, value: '-- remove select --'});
      $scope.removeGroupBySegment = uiSegmentSrv.newSegment({fake: true, value: '-- remove group by --'});
    };

    $scope.getFields = function() {
      return $scope.datasource.metricFindQuery('fields()').then($scope.transformToSegments(true));
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

    $scope.getGroupByFields = function(segment) {
      return $scope.datasource.metricFindQuery('fields()').then($scope.transformToSegments(false))
      .then(function(results) {
        if (segment.type !== 'plus-button') {
          results.splice(0, 0, angular.copy($scope.removeGroupBySegment));
        }
        return results;
      })
      .then(null, $scope.handleQueryError);
    };

    $scope.groupByChanged = function(segment, index) {
      if (segment.value === $scope.removeGroupBySegment.value) {
        $scope.target.groupByFields.splice(index, 1);
        $scope.groupBySegments.splice(index, 1);
        $scope.$parent.get_data();
        return;
      }

      if (index === $scope.groupBySegments.length-1) {
        $scope.groupBySegments.push(uiSegmentSrv.newPlusButton());
      }

      segment.type = 'group-by-key';
      segment.fake = false;

      $scope.target.groupByFields[index] = {field: segment.value};
      $scope.$parent.get_data();
    };

    $scope.valueFieldChanged = function() {
      $scope.target.valueField = $scope.valueFieldSegment.value;
      $scope.$parent.get_data();
    };

    $scope.keyFieldChanged = function() {
      $scope.target.keyField = $scope.keyFieldSegment.value;
      $scope.$parent.get_data();
    };

    $scope.termValueSegmentChanged = function() {
      $scope.target.termValue = $scope.termValueSegment.value;
      $scope.$parent.get_data();
    };

    $scope.termKeySegmentChanged = function() {
      $scope.target.termKey = $scope.termKeySegment.value;
      $scope.$parent.get_data();
    };

    $scope.groupByFieldChanged = function() {
      $scope.target.groupBy = $scope.groupByFieldSegment.value;
      $scope.$parent.get_data();
    };

    $scope.changeFunction = function(func) {
      $scope.target.function = func;
      $scope.$parent.get_data();
    };

    $scope.handleQueryError = function(err) {
      $scope.parserError = err.message || 'Failed to issue metric query';
      return [];
    };

    $scope.toggleQueryMode = function () {
      $scope.target.rawQuery = !$scope.target.rawQuery;
    };

    $scope.init();

  });

});
