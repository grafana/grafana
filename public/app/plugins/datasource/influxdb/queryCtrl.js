define([
  'angular',
  'lodash'
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('InfluxQueryCtrl', function($scope, $timeout, $sce, templateSrv) {

    $scope.functionList = [
      'count', 'mean', 'sum', 'min',
      'max', 'mode', 'distinct', 'median',
      'derivative', 'stddev', 'first', 'last',
      'difference'
    ];

    $scope.functionMenu = _.map($scope.functionList, function(func) {
      return { text: func, click: "changeFunction('" + func + "');" };
    });

    $scope.init = function() {
      var target = $scope.target;
      target.function = target.function || 'mean';

      if (!target.measurement) {
        $scope.measurementSegment = MetricSegment.newSelectMeasurement();
      } else {
        $scope.measurementSegment = new MetricSegment(target.measurement);
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
      // var measurement = $scope.segments[0].value;
      // var queryType, query;
      // if (index === 0) {
      //   queryType = 'MEASUREMENTS';
      //   query = 'SHOW MEASUREMENTS';
      // } else if (index % 2 === 1) {
      //   queryType = 'TAG_KEYS';
      //   query = 'SHOW TAG KEYS FROM "' + measurement + '"';
      // } else {
      //   queryType = 'TAG_VALUES';
      //   query = 'SHOW TAG VALUES FROM "' + measurement + '" WITH KEY = ' + $scope.segments[$scope.segments.length - 2].value;
      // }
      //
      // console.log('getAltSegments: query' , query);
      //
      console.log('get measurements');
      return $scope.datasource.metricFindQuery('SHOW MEASUREMENTS', 'MEASUREMENTS').then(function(results) {
        console.log('get alt segments: response', results);
        var measurements = _.map(results, function(segment) {
          return new MetricSegment({ value: segment.text, expandable: segment.expandable });
        });

        _.each(templateSrv.variables, function(variable) {
          measurements.unshift(new MetricSegment({
            type: 'template',
            value: '$' + variable.name,
            expandable: true,
          }));
        });

        return measurements;
      }, function(err) {
        $scope.parserError = err.message || 'Failed to issue metric query';
        return [];
      });
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

      this.fake = options.fake;
      this.value = options.value;
      this.type = options.type;
      this.expandable = options.expandable;
      this.html = $sce.trustAsHtml(templateSrv.highlightVariablesAsHtml(this.value));
    }

    MetricSegment.newSelectMeasurement = function() {
      return new MetricSegment({value: 'select measurement', fake: true});
    };

    MetricSegment.newSelectTag = function() {
      return new MetricSegment({value: 'select tag', fake: true});
    };

    MetricSegment.newSelectTagValue = function() {
      return new MetricSegment({value: 'select tag value', fake: true});
    };

  });

});
