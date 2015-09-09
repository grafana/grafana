define([
  'angular',
  'lodash',
  './queryBuilder',
],
function (angular, _, InfluxQueryBuilder) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('InfluxQueryCtrl', function($scope, $timeout, $sce, templateSrv, $q, uiSegmentSrv) {

    $scope.init = function() {
      if (!$scope.target) { return; }

      var target = $scope.target;
      target.tags = target.tags || [];
      target.groupBy = target.groupBy || [{type: 'time', interval: 'auto'}];
      target.fields = target.fields || [{name: 'value', func: target.function || 'mean'}];

      $scope.queryBuilder = new InfluxQueryBuilder(target);

      if (!target.measurement) {
        $scope.measurementSegment = uiSegmentSrv.newSelectMeasurement();
      } else {
        $scope.measurementSegment = uiSegmentSrv.newSegment(target.measurement);
      }

      $scope.tagSegments = [];
      _.each(target.tags, function(tag) {
        if (!tag.operator) {
          if (/^\/.*\/$/.test(tag.value)) {
            tag.operator = "=~";
          } else {
            tag.operator = '=';
          }
        }

        if (tag.condition) {
          $scope.tagSegments.push(uiSegmentSrv.newCondition(tag.condition));
        }

        $scope.tagSegments.push(uiSegmentSrv.newKey(tag.key));
        $scope.tagSegments.push(uiSegmentSrv.newOperator(tag.operator));
        $scope.tagSegments.push(uiSegmentSrv.newKeyValue(tag.value));
      });

      $scope.fixTagSegments();
      $scope.removeTagFilterSegment = uiSegmentSrv.newSegment({fake: true, value: '-- remove tag filter --'});
    };

    $scope.fixTagSegments = function() {
      var count = $scope.tagSegments.length;
      var lastSegment = $scope.tagSegments[Math.max(count-1, 0)];

      if (!lastSegment || lastSegment.type !== 'plus-button') {
        $scope.tagSegments.push(uiSegmentSrv.newPlusButton());
      }
    };

    $scope.addGroupBy = function() {
      $scope.target.groupBy.push({type: 'tag', key: "select tag"});
    };

    $scope.removeGroupBy = function(index) {
      $scope.target.groupBy.splice(index, 1);
      $scope.get_data();
    };

    $scope.addSelect = function() {
      $scope.target.fields.push({name: "select field", func: 'mean'});
    };

    $scope.removeSelect = function(index) {
      $scope.target.fields.splice(index, 1);
      $scope.get_data();
    };

    $scope.changeFunction = function(func) {
      $scope.target.function = func;
      $scope.$parent.get_data();
    };

    $scope.measurementChanged = function() {
      $scope.target.measurement = $scope.measurementSegment.value;
      $scope.$parent.get_data();
    };

    $scope.getFields = function() {
      var fieldsQuery = $scope.queryBuilder.buildExploreQuery('FIELDS');
      return $scope.datasource.metricFindQuery(fieldsQuery)
      .then($scope.transformToSegments(false), $scope.handleQueryError);
    };

    $scope.toggleQueryMode = function () {
      $scope.target.rawQuery = !$scope.target.rawQuery;
    };

    $scope.getMeasurements = function () {
      var query = $scope.queryBuilder.buildExploreQuery('MEASUREMENTS');
      return $scope.datasource.metricFindQuery(query)
      .then($scope.transformToSegments(true), $scope.handleQueryError);
    };

    $scope.getFunctions = function () {
      var functionList = ['count', 'mean', 'sum', 'min', 'max', 'mode', 'distinct', 'median',
        'derivative', 'non_negative_derivative', 'stddev', 'first', 'last'
      ];
      return $q.when(_.map(functionList, function(func) {
        return uiSegmentSrv.newSegment(func);
      }));
    };

    $scope.getGroupByTimeIntervals = function () {
      var times = ['auto', '1s', '10s', '1m', '2m', '5m', '10m', '30m', '1h', '1d'];
      return $q.when(_.map(times, function(func) {
        return uiSegmentSrv.newSegment(func);
      }));
    };

    $scope.handleQueryError = function(err) {
      $scope.parserError = err.message || 'Failed to issue metric query';
      return [];
    };

    $scope.transformToSegments = function(addTemplateVars) {
      return function(results) {
        var segments = _.map(results, function(segment) {
          return uiSegmentSrv.newSegment({ value: segment.text, expandable: segment.expandable });
        });

        if (addTemplateVars) {
          _.each(templateSrv.variables, function(variable) {
            segments.unshift(uiSegmentSrv.newSegment({ type: 'template', value: '/$' + variable.name + '$/', expandable: true }));
          });
        }

        return segments;
      };
    };

    $scope.getTagsOrValues = function(segment, index) {
      if (segment.type === 'condition') {
        return $q.when([uiSegmentSrv.newSegment('AND'), uiSegmentSrv.newSegment('OR')]);
      }
      if (segment.type === 'operator') {
        var nextValue = $scope.tagSegments[index+1].value;
        if (/^\/.*\/$/.test(nextValue)) {
          return $q.when(uiSegmentSrv.newOperators(['=~', '!~']));
        } else {
          return $q.when(uiSegmentSrv.newOperators(['=', '<>', '<', '>']));
        }
      }

      var query, addTemplateVars;
      if (segment.type === 'key' || segment.type === 'plus-button') {
        query = $scope.queryBuilder.buildExploreQuery('TAG_KEYS');
        addTemplateVars = false;
      } else if (segment.type === 'value')  {
        query = $scope.queryBuilder.buildExploreQuery('TAG_VALUES', $scope.tagSegments[index-2].value);
        addTemplateVars = true;
      }

      return $scope.datasource.metricFindQuery(query)
      .then($scope.transformToSegments(addTemplateVars))
      .then(function(results) {
        if (segment.type === 'key') {
          results.splice(0, 0, angular.copy($scope.removeTagFilterSegment));
        }
        return results;
      })
      .then(null, $scope.handleQueryError);
    };

    $scope.getFieldSegments = function() {
      var fieldsQuery = $scope.queryBuilder.buildExploreQuery('FIELDS');
      return $scope.datasource.metricFindQuery(fieldsQuery)
      .then($scope.transformToSegments(false))
      .then(null, $scope.handleQueryError);
    };

    $scope.addField = function() {
      $scope.target.fields.push({name: $scope.addFieldSegment.value, func: 'mean'});
      _.extend($scope.addFieldSegment, uiSegmentSrv.newPlusButton());
    };

    $scope.fieldChanged = function(field) {
      if (field.name === '-- remove from select --') {
        $scope.target.fields = _.without($scope.target.fields, field);
      }
      $scope.get_data();
    };

    $scope.getTagOptions = function() {
      var query = $scope.queryBuilder.buildExploreQuery('TAG_KEYS');

      return $scope.datasource.metricFindQuery(query)
      .then($scope.transformToSegments(false))
      .then(null, $scope.handleQueryError);
    };

    $scope.tagSegmentUpdated = function(segment, index) {
      $scope.tagSegments[index] = segment;

      // handle remove tag condition
      if (segment.value === $scope.removeTagFilterSegment.value) {
        $scope.tagSegments.splice(index, 3);
        if ($scope.tagSegments.length === 0) {
          $scope.tagSegments.push(uiSegmentSrv.newPlusButton());
        } else if ($scope.tagSegments.length > 2) {
          $scope.tagSegments.splice(Math.max(index-1, 0), 1);
          if ($scope.tagSegments[$scope.tagSegments.length-1].type !== 'plus-button') {
            $scope.tagSegments.push(uiSegmentSrv.newPlusButton());
          }
        }
      }
      else {
        if (segment.type === 'plus-button') {
          if (index > 2) {
            $scope.tagSegments.splice(index, 0, uiSegmentSrv.newCondition('AND'));
          }
          $scope.tagSegments.push(uiSegmentSrv.newOperator('='));
          $scope.tagSegments.push(uiSegmentSrv.newFake('select tag value', 'value', 'query-segment-value'));
          segment.type = 'key';
          segment.cssClass = 'query-segment-key';
        }

        if ((index+1) === $scope.tagSegments.length) {
          $scope.tagSegments.push(uiSegmentSrv.newPlusButton());
        }
      }

      $scope.rebuildTargetTagConditions();
    };

    $scope.rebuildTargetTagConditions = function() {
      var tags = [];
      var tagIndex = 0;
      var tagOperator = "";
      _.each($scope.tagSegments, function(segment2, index) {
        if (segment2.type === 'key') {
          if (tags.length === 0) {
            tags.push({});
          }
          tags[tagIndex].key = segment2.value;
        }
        else if (segment2.type === 'value') {
          tagOperator = $scope.getTagValueOperator(segment2.value, tags[tagIndex].operator);
          if (tagOperator) {
            $scope.tagSegments[index-1] = uiSegmentSrv.newOperator(tagOperator);
            tags[tagIndex].operator = tagOperator;
          }
          tags[tagIndex].value = segment2.value;
        }
        else if (segment2.type === 'condition') {
          tags.push({ condition: segment2.value });
          tagIndex += 1;
        }
        else if (segment2.type === 'operator') {
          tags[tagIndex].operator = segment2.value;
        }
      });

      $scope.target.tags = tags;
      $scope.$parent.get_data();
    };

    $scope.getTagValueOperator = function(tagValue, tagOperator) {
      if (tagOperator !== '=~' && tagOperator !== '!~' && /^\/.*\/$/.test(tagValue)) {
        return '=~';
      }
      else if ((tagOperator === '=~' || tagOperator === '!~') && /^(?!\/.*\/$)/.test(tagValue)) {
        return '=';
      }
    };

    $scope.init();

  });

});
