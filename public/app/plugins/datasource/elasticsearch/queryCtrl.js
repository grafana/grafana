define([
  'angular',
  'lodash',
  './queryBuilder',
],
function (angular, _, ElasticQueryBuilder) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ElasticQueryCtrl', function($scope, $timeout, $sce, templateSrv, $q) {

    $scope.functionList = ['count', 'min', 'max', 'total', 'mean'];

    $scope.functionMenu = _.map($scope.functionList, function(func) {
      return { text: func, click: "changeFunction('" + func + "');" };
    });

    $scope.init = function() {
      var target = $scope.target;
      target.function = target.function || 'mean';

      $scope.queryBuilder = new ElasticQueryBuilder(target);

      if (!target.keyField) {
        target.keyField = '@timestamp';
      }
      $scope.keyFieldSegment = new MetricSegment({value: target.keyField});

      if (!target.valueField) {
        target.valueField = 'metric';
      }
      $scope.valueFieldSegment = new MetricSegment({value: target.valueField});

      if (!target.termKey) {
        target.termKey = 'service.raw';
      }
      $scope.termKeySegment = new MetricSegment({value: target.termKey});

      if (!target.termValue) {
        target.termValue = 'cpu-average/cpu-user';
      }
      $scope.termValueSegment = new MetricSegment({value: target.termValue});

      if (!target.groupByField) {
        target.groupByField = 'host.raw';
      }
      $scope.groupByFieldSegment = new MetricSegment({value: target.groupByField});

      if (!target.measurement) {
        $scope.measurementSegment = MetricSegment.newSelectMeasurement();
      } else {
        $scope.measurementSegment = new MetricSegment(target.measurement);
      }

      $scope.tagSegments = [];
      _.each(target.tags, function(tag) {
        if (tag.condition) {
          $scope.tagSegments.push(MetricSegment.newCondition(tag.condition));
        }
        $scope.tagSegments.push(new MetricSegment({value: tag.key, type: 'key', cssClass: 'query-segment-key' }));
        $scope.tagSegments.push(new MetricSegment.newOperator("="));
        $scope.tagSegments.push(new MetricSegment({value: tag.value, type: 'value', cssClass: 'query-segment-value'}));
      });

      $scope.fixTagSegments();

      $scope.groupBySegments = [];
      _.each(target.groupByTags, function(tag) {
        $scope.groupBySegments.push(new MetricSegment(tag));
      });

      $scope.groupBySegments.push(MetricSegment.newPlusButton());

      $scope.removeTagFilterSegment = new MetricSegment({fake: true, value: '-- remove tag filter --'});
      $scope.removeGroupBySegment = new MetricSegment({fake: true, value: '-- remove group by --'});
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

    $scope.fixTagSegments = function() {
      var count = $scope.tagSegments.length;
      var lastSegment = $scope.tagSegments[Math.max(count-1, 0)];

      if (!lastSegment || lastSegment.type !== 'plus-button') {
        $scope.tagSegments.push(MetricSegment.newPlusButton());
      }
    };

    $scope.groupByTagUpdated = function(segment, index) {
      if (segment.value === $scope.removeGroupBySegment.value) {
        $scope.target.groupByTags.splice(index, 1);
        $scope.groupBySegments.splice(index, 1);
        $scope.$parent.get_data();
        return;
      }

      if (index === $scope.groupBySegments.length-1) {
        $scope.groupBySegments.push(MetricSegment.newPlusButton());
      }

      segment.type = 'group-by-key';
      segment.fake = false;

      $scope.target.groupByTags[index] = segment.value;
      $scope.$parent.get_data();
    };

    $scope.changeFunction = function(func) {
      $scope.target.function = func;
      $scope.$parent.get_data();
    };

    $scope.measurementChanged = function() {
      $scope.target.measurement = $scope.measurementSegment.value;
      $scope.$parent.get_data();
    };

    $scope.toggleQueryMode = function () {
      $scope.target.rawQuery = !$scope.target.rawQuery;
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
