define([
  'angular',
  'lodash',
  './query_builder',
],
function (angular, _, InfluxQueryBuilder) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.directive('metricQueryEditorInfluxdb', function() {
    return {
      controller: 'InfluxQueryCtrl',
      templateUrl: 'app/plugins/datasource/influxdb/partials/query.editor.html',
    };
  });

  module.directive('metricQueryOptionsInfluxdb', function() {
    return {
      templateUrl: 'app/plugins/datasource/influxdb/partials/query.options.html',
    };
  });

  module.controller('InfluxQueryCtrl', function($scope, $timeout, $sce, templateSrv, $q) {

    $scope.init = function() {
      var target = $scope.target;
      target.tags = target.tags || [];
      target.groupByTags = target.groupByTags || [];
      target.fields = target.fields || [{
        name: 'value',
        func: target.function || 'mean'
      }];

      $scope.queryBuilder = new InfluxQueryBuilder(target);

      if (!target.measurement) {
        $scope.measurementSegment = MetricSegment.newSelectMeasurement();
      } else {
        $scope.measurementSegment = new MetricSegment(target.measurement);
      }

      $scope.addFieldSegment = MetricSegment.newPlusButton();

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
          $scope.tagSegments.push(MetricSegment.newCondition(tag.condition));
        }
        $scope.tagSegments.push(new MetricSegment({value: tag.key, type: 'key', cssClass: 'query-segment-key' }));
        $scope.tagSegments.push(MetricSegment.newOperator(tag.operator));
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

    $scope.getFields = function() {
      var fieldsQuery = $scope.queryBuilder.buildExploreQuery('FIELDS');
      return $scope.datasource.metricFindQuery(fieldsQuery)
      .then(function(results) {
        var values = _.pluck(results, 'text');
        if ($scope.target.fields.length > 1) {
          values.splice(0, 0, "-- remove from select --");
        }
        return values;
      });
    };

    $scope.toggleQueryMode = function () {
      $scope.target.rawQuery = !$scope.target.rawQuery;
    };

    $scope.getMeasurements = function () {
      var query = $scope.queryBuilder.buildExploreQuery('MEASUREMENTS');
      return $scope.datasource.metricFindQuery(query)
      .then($scope.transformToSegments(true))
      .then(null, $scope.handleQueryError);
    };

    $scope.handleQueryError = function(err) {
      $scope.parserError = err.message || 'Failed to issue metric query';
      return [];
    };

    $scope.transformToSegments = function(addTemplateVars) {
      return function(results) {
        var segments = _.map(results, function(segment) {
          return new MetricSegment({ value: segment.text, expandable: segment.expandable });
        });

        if (addTemplateVars) {
          _.each(templateSrv.variables, function(variable) {
<<<<<<< 069619ee14f2f3f8425dedb43ef12001c70c7eed
            segments.unshift(new MetricSegment({ type: 'template', value: '/$' + variable.name + '/', expandable: true }));
=======
            segments.unshift(new MetricSegment({ type: 'template', value: '/$' + variable.name + '$/', expandable: true }));
>>>>>>> fix(influxdb): fixed influxdb template var filter suggestion, fixes #2666
          });
        }

        return segments;
      };
    };

    $scope.getTagsOrValues = function(segment, index) {
      if (segment.type === 'condition') {
        return $q.when([new MetricSegment('AND'), new MetricSegment('OR')]);
      }
      if (segment.type === 'operator') {
        var nextValue = $scope.tagSegments[index+1].value;
        if (/^\/.*\/$/.test(nextValue)) {
          return $q.when(MetricSegment.newOperators(['=~', '!~']));
        } else {
          return $q.when(MetricSegment.newOperators(['=', '<>', '<', '>']));
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
      .then($scope.transformToSegments)
      .then(null, $scope.handleQueryError);
    };

    $scope.addField = function() {
      $scope.target.fields.push({name: $scope.addFieldSegment.value, func: 'mean'});
      _.extend($scope.addFieldSegment, MetricSegment.newPlusButton());
    };

    $scope.fieldChanged = function(field) {
      if (field.name === '-- remove from select --') {
        $scope.target.fields = _.without($scope.target.fields, field);
      }
      $scope.get_data();
    };

    $scope.getGroupByTagSegments = function(segment) {
      var query = $scope.queryBuilder.buildExploreQuery('TAG_KEYS');

      return $scope.datasource.metricFindQuery(query)
      .then($scope.transformToSegments(false))
      .then(function(results) {
        if (segment.type !== 'plus-button') {
          results.splice(0, 0, angular.copy($scope.removeGroupBySegment));
        }
        return results;
      })
      .then(null, $scope.handleQueryError);
    };

    $scope.tagSegmentUpdated = function(segment, index) {
      $scope.tagSegments[index] = segment;

      // handle remove tag condition
      if (segment.value === $scope.removeTagFilterSegment.value) {
        $scope.tagSegments.splice(index, 3);
        if ($scope.tagSegments.length === 0) {
          $scope.tagSegments.push(MetricSegment.newPlusButton());
        } else if ($scope.tagSegments.length > 2) {
          $scope.tagSegments.splice(Math.max(index-1, 0), 1);
          if ($scope.tagSegments[$scope.tagSegments.length-1].type !== 'plus-button') {
            $scope.tagSegments.push(MetricSegment.newPlusButton());
          }
        }
      }
      else {
        if (segment.type === 'plus-button') {
          if (index > 2) {
            $scope.tagSegments.splice(index, 0, MetricSegment.newCondition('AND'));
          }
          $scope.tagSegments.push(MetricSegment.newOperator('='));
          $scope.tagSegments.push(MetricSegment.newFake('select tag value', 'value', 'query-segment-value'));
          segment.type = 'key';
          segment.cssClass = 'query-segment-key';
        }

        if ((index+1) === $scope.tagSegments.length) {
          $scope.tagSegments.push(MetricSegment.newPlusButton());
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
            $scope.tagSegments[index-1] = MetricSegment.newOperator(tagOperator);
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

    MetricSegment.newFake = function(text, type, cssClass) {
      return new MetricSegment({value: text, fake: true, type: type, cssClass: cssClass});
    };

    MetricSegment.newCondition = function(condition) {
      return new MetricSegment({value: condition, type: 'condition', cssClass: 'query-keyword' });
    };

    MetricSegment.newOperator = function(op) {
      return new MetricSegment({value: op, type: 'operator', cssClass: 'query-segment-operator' });
    };

    MetricSegment.newOperators = function(ops) {
      return _.map(ops, function(op) {
        return new MetricSegment({value: op, type: 'operator', cssClass: 'query-segment-operator' });
      });
    };

    MetricSegment.newPlusButton = function() {
      return new MetricSegment({fake: true, html: '<i class="fa fa-plus "></i>', type: 'plus-button' });
    };

    MetricSegment.newSelectTagValue = function() {
      return new MetricSegment({value: 'select tag value', fake: true});
    };

    $scope.init();

  });

});
