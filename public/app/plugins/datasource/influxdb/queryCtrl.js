define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('InfluxQueryCtrl', function($scope, $timeout, $sce, templateSrv, $q) {

    $scope.functionList = [
      'count', 'mean', 'sum', 'min', 'max', 'mode', 'distinct', 'median',
      'derivative', 'stddev', 'first', 'last', 'difference'
    ];

    $scope.functionMenu = _.map($scope.functionList, function(func) {
      return { text: func, click: "changeFunction('" + func + "');" };
    });

    $scope.init = function() {
      var target = $scope.target;
      target.function = target.function || 'mean';
      target.tags = target.tags || [];
      target.groupByTags = target.groupByTags || [];

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
        $scope.tagSegments.push(new MetricSegment({value: tag.key, type: 'key' }));
        $scope.tagSegments.push(new MetricSegment({fake: true, value: "="}));
        $scope.tagSegments.push(new MetricSegment({value: tag.value, type: 'value'}));
      });

      if ($scope.tagSegments.length % 3 === 0) {
        $scope.tagSegments.push(MetricSegment.newPlusButton());
      }

      $scope.groupBySegments = [];
      _.each(target.groupByTags, function(tag) {
        $scope.groupBySegments.push(new MetricSegment(tag));
      });

      $scope.groupBySegments.push(MetricSegment.newPlusButton());
    };

    $scope.groupByTagUpdated = function(segment, index) {
      if (index === $scope.groupBySegments.length-1) {
        $scope.groupBySegments.push(MetricSegment.newPlusButton());
      }
    };

    $scope.changeFunction = function(func) {
      $scope.target.function = func;
      $scope.$parent.get_data();
    };

    $scope.measurementChanged = function() {
      $scope.target.measurement = $scope.measurementSegment.value;
      console.log('measurement updated', $scope.target.measurement);
      $scope.$parent.get_data();
    };

    $scope.toggleQueryMode = function () {
      $scope.target.rawQuery = !$scope.target.rawQuery;
    };

    $scope.moveMetricQuery = function(fromIndex, toIndex) {
      _.move($scope.panel.targets, fromIndex, toIndex);
    };

    $scope.duplicate = function() {
      var clone = angular.copy($scope.target);
      $scope.panel.targets.push(clone);
    };

    $scope.getMeasurements = function () {
      return $scope.datasource.metricFindQuery('SHOW MEASUREMENTS', 'MEASUREMENTS')
      .then($scope.transformToSegments)
      .then($scope.addTemplateVariableSegments)
      .then(null, $scope.handleQueryError);
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

    $scope.getTagsOrValues = function(segment, index) {
      var query, queryType;
      if (segment.type === 'key' || segment.type === 'plus-button') {
        queryType = 'TAG_KEYS';
        query = 'SHOW TAG KEYS FROM "' + $scope.target.measurement + '"';
      } else if (segment.type === 'value')  {
        queryType = 'TAG_VALUES';
        query = 'SHOW TAG VALUES FROM "' + $scope.target.measurement + '" WITH KEY = ' + $scope.tagSegments[index-2].value;
      } else if (segment.type === 'condition') {
        return $q.when([new MetricSegment('AND'), new MetricSegment('OR')]);
      }
      else  {
        return $q.when([]);
      }

      return $scope.datasource.metricFindQuery(query, queryType)
      .then($scope.transformToSegments)
      .then($scope.addTemplateVariableSegments)
      .then(function(results) {
        if (queryType === 'TAG_KEYS' && segment.type !== 'plus-button') {
          results.push(new MetricSegment({fake: true, value: 'remove tag filter'}));
        }
        return results;
      })
      .then(null, $scope.handleQueryError);
    };

    $scope.tagSegmentUpdated = function(segment, index) {
      $scope.tagSegments[index] = segment;

      if (segment.value === 'remove tag filter') {
        $scope.tagSegments.splice(index, 3);
        if ($scope.tagSegments.length === 0) {
          $scope.tagSegments.push(MetricSegment.newPlusButton());
        } else {
          $scope.tagSegments.splice(index-1, 1);
          $scope.tagSegments.push(MetricSegment.newPlusButton());
        }
      }
      else {
        if (segment.type === 'plus-button') {
          if (index > 2) {
            $scope.tagSegments.splice(index, 0, MetricSegment.newCondition('AND'));
          }
          $scope.tagSegments.push(new MetricSegment({fake: true, value: '=', type: 'operator'}));
          $scope.tagSegments.push(new MetricSegment({fake: true, value: 'select tag value', type: 'value' }));
          segment.type = 'key';
        }

        if ((index+1) === $scope.tagSegments.length) {
          $scope.tagSegments.push(MetricSegment.newPlusButton());
        }
      }

      $scope.rebuildTargetTagConditions();
    };

    $scope.rebuildTargetTagConditions = function() {
      var tags = [{}];
      var tagIndex = 0;
      _.each($scope.tagSegments, function(segment2) {
        if (segment2.type === 'key') {
          tags[tagIndex].key = segment2.value;
        }
        else if (segment2.type === 'value') {
          tags[tagIndex].value = segment2.value;
        }
        else if (segment2.type === 'condition') {
          tags.push({ condition: segment2.value });
          tagIndex += 1;
        }
      });

      $scope.target.tags = tags;
      $scope.$parent.get_data();
    };

    function MetricSegment(options) {
      if (options === '*' || options.value === '*') {
        this.value = '*';
        this.html = $sce.trustAsHtml('<i class="fa fa-asterisk"><i>');
        this.expandable = true;
        return;
      }

      if (_.isString(options)) {
        this.value = options;
        this.html = $sce.trustAsHtml(this.value);
        return;
      }

      this.cssClass = options.cssClass;
      this.type = options.type;
      this.fake = options.fake;
      this.value = options.value;
      this.type = options.type;
      this.expandable = options.expandable;
      this.html = options.html || $sce.trustAsHtml(templateSrv.highlightVariablesAsHtml(this.value));
    }

    MetricSegment.newSelectMeasurement = function() {
      return new MetricSegment({value: 'select measurement', fake: true});
    };

    MetricSegment.newCondition = function(condition) {
      return new MetricSegment({value: condition, type: 'condition', cssClass: 'query-keyword' });
    };

    MetricSegment.newPlusButton = function() {
      return new MetricSegment({fake: true, html: '<i class="fa fa-plus"></i>', type: 'plus-button' });
    };

    MetricSegment.newSelectTagValue = function() {
      return new MetricSegment({value: 'select tag value', fake: true});
    };

  });

});
