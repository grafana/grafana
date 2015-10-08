define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('CloudWatchQueryCtrl', function($scope, templateSrv, uiSegmentSrv, $q) {

    $scope.init = function() {
      $scope.target.namespace = $scope.target.namespace || '';
      $scope.target.metricName = $scope.target.metricName || '';
      $scope.target.statistics = $scope.target.statistics || {Average: true};
      $scope.target.dimensions = $scope.target.dimensions || {};
      $scope.target.period = $scope.target.period || 60;
      $scope.target.region = $scope.target.region || $scope.datasource.getDefaultRegion();

      $scope.regionSegment =  uiSegmentSrv.getSegmentForValue($scope.target.region, 'select region');
      $scope.namespaceSegment = uiSegmentSrv.getSegmentForValue($scope.target.namespace, 'select namespace');
      $scope.metricSegment = uiSegmentSrv.getSegmentForValue($scope.target.metricName, 'select metric');

      $scope.dimSegments = _.reduce($scope.target.dimensions, function(memo, value, key) {
        memo.push(uiSegmentSrv.newKey(key));
        memo.push(uiSegmentSrv.newOperator("="));
        memo.push(uiSegmentSrv.newKeyValue(value));
        return memo;
      }, []);

      $scope.fixSegments();
      $scope.removeDimSegment = uiSegmentSrv.newSegment({fake: true, value: '-- remove dimension --'});
    };

    $scope.fixSegments = function() {
      var count = $scope.dimSegments.length;
      var lastSegment = $scope.dimSegments[Math.max(count-1, 0)];

      if (!lastSegment || lastSegment.type !== 'plus-button') {
        $scope.dimSegments.push(uiSegmentSrv.newPlusButton());
      }
    };

    $scope.getDimSegments = function(segment) {
      if (segment.type === 'operator') { return $q.when([]); }

      var target = $scope.target;
      var query = $q.when([]);

      if (segment.type === 'key' || segment.type === 'plus-button') {
        query = $scope.datasource.getDimensionKeys($scope.target.namespace);
      } else if (segment.type === 'value')  {
        query = $scope.datasource.getDimensionValues(target.region, target.namespace, target.metricName, {});
      }

      return query.then($scope.transformToSegments(true)).then(function(results) {
        if (segment.type === 'key') {
          results.splice(0, 0, angular.copy($scope.removeDimSegment));
        }
        return results;
      });
    };

    $scope.dimSegmentChanged = function(segment, index) {
      $scope.dimSegments[index] = segment;

      if (segment.value === $scope.removeDimSegment.value) {
        $scope.dimSegments.splice(index, 3);
      }
      else if (segment.type === 'plus-button') {
        $scope.dimSegments.push(uiSegmentSrv.newOperator('='));
        $scope.dimSegments.push(uiSegmentSrv.newFake('select dimension value', 'value', 'query-segment-value'));
        segment.type = 'key';
        segment.cssClass = 'query-segment-key';
      }

      $scope.fixSegments();
      $scope.syncDimSegmentsWithModel();
      $scope.get_data();
    };

    $scope.syncDimSegmentsWithModel = function() {
      var dims = {};
      var length = $scope.dimSegments.length;

      for (var i = 0; i < length - 2; i += 3) {
        var keySegment = $scope.dimSegments[i];
        var valueSegment = $scope.dimSegments[i + 2];
        if (!valueSegment.fake) {
          dims[keySegment.value] = valueSegment.value;
        }
      }

      $scope.target.dimensions = dims;
    };

    $scope.getRegions = function() {
      return $scope.datasource.metricFindQuery('regions()')
      .then($scope.transformToSegments(true));
    };

    $scope.getNamespaces = function() {
      return $scope.datasource.metricFindQuery('namespaces()')
      .then($scope.transformToSegments(true));
    };

    $scope.getMetrics = function() {
      return $scope.datasource.metricFindQuery('metrics(' + $scope.target.namespace + ')')
      .then($scope.transformToSegments(true));
    };

    $scope.regionChanged = function() {
      $scope.target.region = $scope.regionSegment.value;
      $scope.get_data();
    };

    $scope.namespaceChanged = function() {
      $scope.target.namespace = $scope.namespaceSegment.value;
      $scope.get_data();
    };

    $scope.metricChanged = function() {
      $scope.target.metricName = $scope.metricSegment.value;
      $scope.get_data();
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

    $scope.refreshMetricData = function() {
      if (!_.isEqual($scope.oldTarget, $scope.target)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };

    $scope.addDimension = function() {
      if (!$scope.addDimensionMode) {
        $scope.addDimensionMode = true;
        return;
      }

      if (!$scope.target.dimensions) {
        $scope.target.dimensions = {};
      }

      $scope.target.dimensions[$scope.target.currentDimensionKey] = $scope.target.currentDimensionValue;
      $scope.target.escapedDimensions = this.escapeDimensions($scope.target.dimensions);
      $scope.target.currentDimensionKey = '';
      $scope.target.currentDimensionValue = '';
      $scope.refreshMetricData();

      $scope.addDimensionMode = false;
    };

    $scope.removeDimension = function(key) {
      key = key.replace(/\\\$/g, '$');
      delete $scope.target.dimensions[key];
      $scope.target.escapedDimensions = this.escapeDimensions($scope.target.dimensions);
      $scope.refreshMetricData();
    };

    $scope.escapeDimensions = function(d) {
      var result = {};
      _.chain(d)
      .keys(d)
      .each(function(k) {
        var v = d[k];
        result[k.replace(/\$/g, '\uFF04')] = v.replace(/\$/g, '\$');
      });

      return result;
    };

    $scope.statisticsOptionChanged = function() {
      $scope.refreshMetricData();
    };

    $scope.init();

  });

});
