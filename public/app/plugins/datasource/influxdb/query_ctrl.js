define([
  'angular',
  'lodash',
  './query_builder',
  './influx_query',
  './query_part',
  './query_part_editor',
],
function (angular, _, InfluxQueryBuilder, InfluxQuery, queryPart) {
  'use strict';

  var module = angular.module('grafana.controllers');

  InfluxQuery = InfluxQuery.default;
  queryPart = queryPart.default;

  module.controller('InfluxQueryCtrl', function($scope, templateSrv, $q, uiSegmentSrv) {
    var panelCtrl = $scope.ctrl;
    var datasource = $scope.datasource;
    $scope.panelCtrl = panelCtrl;

    $scope.init = function() {
      if (!$scope.target) { return; }

      $scope.target = $scope.target;
      $scope.queryModel = new InfluxQuery($scope.target);
      $scope.queryBuilder = new InfluxQueryBuilder($scope.target, datasource.database);
      $scope.groupBySegment = uiSegmentSrv.newPlusButton();
      $scope.resultFormats = [
         {text: 'Time series', value: 'time_series'},
         {text: 'Table', value: 'table'},
      ];

      $scope.policySegment = uiSegmentSrv.newSegment($scope.target.policy);

      if (!$scope.target.measurement) {
        $scope.measurementSegment = uiSegmentSrv.newSelectMeasurement();
      } else {
        $scope.measurementSegment = uiSegmentSrv.newSegment($scope.target.measurement);
      }

      $scope.tagSegments = [];
      _.each($scope.target.tags, function(tag) {
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
      $scope.buildSelectMenu();
      $scope.removeTagFilterSegment = uiSegmentSrv.newSegment({fake: true, value: '-- remove tag filter --'});
    };

    $scope.buildSelectMenu = function() {
      var categories = queryPart.getCategories();
      $scope.selectMenu = _.reduce(categories, function(memo, cat, key) {
        var menu = {text: key};
        menu.submenu = _.map(cat, function(item) {
          return {text: item.type, value: item.type};
        });
        memo.push(menu);
        return memo;
      }, []);
    };

    $scope.getGroupByOptions = function() {
      var query = $scope.queryBuilder.buildExploreQuery('TAG_KEYS');

      return datasource.metricFindQuery(query)
      .then(function(tags) {
        var options = [];
        if (!$scope.queryModel.hasFill()) {
          options.push(uiSegmentSrv.newSegment({value: 'fill(null)'}));
        }
        if (!$scope.queryModel.hasGroupByTime()) {
          options.push(uiSegmentSrv.newSegment({value: 'time($interval)'}));
        }
        _.each(tags, function(tag) {
          options.push(uiSegmentSrv.newSegment({value: 'tag(' + tag.text + ')'}));
        });
        return options;
      })
      .then(null, $scope.handleQueryError);
    };

    $scope.groupByAction = function() {
      $scope.queryModel.addGroupBy($scope.groupBySegment.value);
      var plusButton = uiSegmentSrv.newPlusButton();
      $scope.groupBySegment.value  = plusButton.value;
      $scope.groupBySegment.html  = plusButton.html;
      panelCtrl.refresh();
    };

    $scope.removeGroupByPart = function(part, index) {
      $scope.queryModel.removeGroupByPart(part, index);
      panelCtrl.refresh();
    };

    $scope.addSelectPart = function(selectParts, cat, subitem) {
      $scope.queryModel.addSelectPart(selectParts, subitem.value);
      panelCtrl.refresh();
    };

    $scope.removeSelectPart = function(selectParts, part) {
      $scope.queryModel.removeSelectPart(selectParts, part);
      panelCtrl.refresh();
    };

    $scope.selectPartUpdated = function() {
      panelCtrl.refresh();
    };

    $scope.fixTagSegments = function() {
      var count = $scope.tagSegments.length;
      var lastSegment = $scope.tagSegments[Math.max(count-1, 0)];

      if (!lastSegment || lastSegment.type !== 'plus-button') {
        $scope.tagSegments.push(uiSegmentSrv.newPlusButton());
      }
    };

    $scope.measurementChanged = function() {
      $scope.target.measurement = $scope.measurementSegment.value;
      panelCtrl.refresh();
    };

    $scope.getPolicySegments = function() {
      var policiesQuery = $scope.queryBuilder.buildExploreQuery('RETENTION POLICIES');
      return datasource.metricFindQuery(policiesQuery)
      .then($scope.transformToSegments(false))
      .then(null, $scope.handleQueryError);
    };

    $scope.policyChanged = function() {
      $scope.target.policy = $scope.policySegment.value;
      panelCtrl.refresh();
    };

    $scope.toggleQueryMode = function () {
      $scope.target.rawQuery = !$scope.target.rawQuery;
    };

    $scope.getMeasurements = function () {
      var query = $scope.queryBuilder.buildExploreQuery('MEASUREMENTS');
      return datasource.metricFindQuery(query)
      .then($scope.transformToSegments(true), $scope.handleQueryError);
    };

    $scope.getPartOptions = function(part) {
      if (part.def.type === 'field') {
        var fieldsQuery = $scope.queryBuilder.buildExploreQuery('FIELDS');
        return datasource.metricFindQuery(fieldsQuery)
        .then($scope.transformToSegments(true), $scope.handleQueryError);
      }
      if (part.def.type === 'tag') {
        var tagsQuery = $scope.queryBuilder.buildExploreQuery('TAG_KEYS');
        return datasource.metricFindQuery(tagsQuery)
        .then($scope.transformToSegments(true), $scope.handleQueryError);
      }
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

      return datasource.metricFindQuery(query)
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
      return datasource.metricFindQuery(fieldsQuery)
      .then($scope.transformToSegments(false))
      .then(null, $scope.handleQueryError);
    };

    $scope.getTagOptions = function() {
   };

    $scope.setFill = function(fill) {
      $scope.target.fill = fill;
      panelCtrl.refresh();
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
      panelCtrl.refresh();
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
