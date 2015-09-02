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
      target.timestampField = target.timestampField || '@timestamp';
      target.valueField = target.valueField || 'value' ;

      $scope.timestampSegment = uiSegmentSrv.newSegment(target.timestampField);
      $scope.valueFieldSegment = uiSegmentSrv.newSegment(target.valueField);

      $scope.termKeySegment = uiSegmentSrv.getSegmentForValue(target.termKey, 'select term field');
      $scope.termValueSegment = uiSegmentSrv.getSegmentForValue(target.termValue, 'select term value');
      $scope.groupByFieldSegment = uiSegmentSrv.getSegmentForValue(target.groupByField, 'add group by');
    };

    $scope.getFields = function() {
      return $scope.datasource.metricFindQuery('fields()')
        .then($scope.transformToSegments(true));
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

    $scope.transformToSegments = function(results) {
      return _.map(results, function(segment) {
        return new MetricSegment({ value: segment.text, expandable: segment.expandable });
      });
    };

    $scope.addTemplateVariableSegments = function(segments) {
      _.each(templateSrv.variables, function(variable) {
        segments.unshift(new MetricSegment({ type: 'template', value: '$' + variable.name, expandable: true }));
      });
      return segments;
    };

    $scope.init();

  });

});
