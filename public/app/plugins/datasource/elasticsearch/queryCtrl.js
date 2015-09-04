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
      target.select = target.select || [{ agg: 'count' }];
      target.groupByFields = target.groupByFields || [];

      $scope.timeSegment = uiSegmentSrv.newSegment(target.timeField);

      $scope.groupBySegments = _.map(target.groupByFields, function(group) {
        return uiSegmentSrv.newSegment(group.field);
      });

      $scope.initSelectSegments();
      $scope.groupBySegments.push(uiSegmentSrv.newPlusButton());
      $scope.removeSelectSegment = uiSegmentSrv.newSegment({fake: true, value: '-- remove select --'});
      $scope.resetSelectSegment = uiSegmentSrv.newSegment({fake: true, value: '-- reset --'});
      $scope.removeGroupBySegment = uiSegmentSrv.newSegment({fake: true, value: '-- remove group by --'});

      $scope.queryBuilder = new ElasticQueryBuilder(target);
      $scope.rawQueryOld = angular.toJson($scope.queryBuilder.build($scope.target), true);
    };

    $scope.initSelectSegments = function() {
      $scope.selectSegments = [];
      _.each($scope.target.select, function(select) {
        if ($scope.selectSegments.length > 0) {
          $scope.selectSegments.push(uiSegmentSrv.newCondition(" and "));
        }
        if (select.agg === 'count') {
          $scope.selectSegments.push(uiSegmentSrv.newSegment({value: select.agg, type: 'agg'}));
        } else {
          $scope.selectSegments.push(uiSegmentSrv.newSegment({value: select.agg, type: 'agg'}));
          $scope.selectSegments.push(uiSegmentSrv.newSegment({value: select.field, type: 'field' }));
        }
      });

      $scope.selectSegments.push(uiSegmentSrv.newPlusButton());
    };

    $scope.getSelectSegments = function(segment, index) {
      if (segment.type === 'agg' || segment.type === 'plus-button') {
        var options = [
          uiSegmentSrv.newSegment({value: 'count', type: 'agg'}),
          uiSegmentSrv.newSegment({value: 'min',   type: 'agg', reqField: true}),
          uiSegmentSrv.newSegment({value: 'max',   type: 'agg', reqField: true}),
          uiSegmentSrv.newSegment({value: 'avg',   type: 'agg', reqField: true}),
        ];
        // if we have other selects and this is not a plus button add remove option
        if (segment.type !== 'plus-button' && $scope.selectSegments.length > 3) {
          options.splice(0, 0, angular.copy($scope.removeSelectSegment));
        }
        // revert option is to reset the selectSegments if they become fucked
        if (index === 0 && $scope.selectSegments.length > 2) {
          options.splice(0, 0, angular.copy($scope.resetSelectSegment));
        }
        return $q.when(options);
      }

      return $scope.datasource.metricFindQuery('fields()')
      .then($scope.transformToSegments(false))
      .then(null, $scope.handleQueryError);
    };

    $scope.selectChanged = function(segment, index) {
      // reset
      if (segment.value === $scope.resetSelectSegment.value) {
        $scope.target.select = [{ agg: 'count' }];
        $scope.initSelectSegments();
        $scope.queryUpdated();
        return;
      }

      var nextSegment, removeCount;

      // remove this select field
      if (segment.value === $scope.removeSelectSegment.value) {
        nextSegment = $scope.selectSegments[index + 1];
        removeCount = 2;
        if (nextSegment && nextSegment.type === 'field') {
          removeCount += 1;
        }
        $scope.selectSegments.splice(Math.max(index-1, 0), removeCount);
        $scope.rebuildTargetSelects();
        $scope.queryUpdated();
        return;
      }

      // add new
      if (segment.type === 'plus-button' && index > 0) {
        $scope.selectSegments.splice(index, 0, uiSegmentSrv.newCondition(' And '));
        segment.type = 'agg';
        index += 1;
      }

      if (segment.type === 'agg')  {
        nextSegment = $scope.selectSegments[index + 1];

        if (segment.value === 'count' && nextSegment && nextSegment.type === 'field') {
          $scope.selectSegments.splice(index + 1, 1);
        } else if (!nextSegment || nextSegment.type !== 'field') {
          $scope.selectSegments.splice(index + 1, 0, uiSegmentSrv.newSegment({value: 'select field', fake: true, type: 'field'}));
        }
      }

      if ((index+1) === $scope.selectSegments.length) {
        $scope.selectSegments.push(uiSegmentSrv.newPlusButton());
      }

      $scope.rebuildTargetSelects();
      $scope.queryUpdated();
    };

    $scope.rebuildTargetSelects = function() {
      $scope.target.select = [];
      for (var i = 0; i < $scope.selectSegments.length; i++) {
        var segment = $scope.selectSegments[i];
        var select = {agg: segment.value };

        if (segment.type === 'agg' && segment.value !== 'count') {
          select.field = $scope.selectSegments[i+1].value;
          i += 2;
        } else {
          i += 1;
        }

        if (select.field === 'select field') { continue; }
        $scope.target.select.push(select);
      }
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
        $scope.queryUpdated();
        return;
      }

      if (index === $scope.groupBySegments.length-1) {
        $scope.groupBySegments.push(uiSegmentSrv.newPlusButton());
      }

      segment.type = 'group-by-key';
      segment.fake = false;

      $scope.target.groupByFields[index] = {field: segment.value};
      $scope.queryUpdated();
    };

    $scope.queryUpdated = function() {
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
