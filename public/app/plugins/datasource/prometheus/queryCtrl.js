define([
  'angular',
  'lodash',
  'kbn',
  'app/core/utils/datemath',
],
function (angular, _, kbn, dateMath) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('PrometheusQueryCtrl', function($scope) {

    $scope.init = function() {
      $scope.target.errors = validateTarget();
      $scope.target.datasourceErrors = {};

      if (!$scope.target.expr) {
        $scope.target.expr = '';
      }
      $scope.target.metric = '';

      $scope.resolutions = [
        { factor:  1, },
        { factor:  2, },
        { factor:  3, },
        { factor:  5, },
        { factor: 10, },
      ];
      $scope.resolutions = _.map($scope.resolutions, function(r) {
        r.label = '1/' + r.factor;
        return r;
      });
      if (!$scope.target.intervalFactor) {
        $scope.target.intervalFactor = 2; // default resolution is 1/2
      }

      $scope.calculateInterval();
      $scope.$on('render', function() {
        $scope.calculateInterval(); // re-calculate interval when time range is updated
      });
      $scope.target.prometheusLink = $scope.linkToPrometheus();

      $scope.$on('typeahead-updated', function() {
        $scope.$apply($scope.inputMetric);
        $scope.refreshMetricData();
      });

      $scope.datasource.lastErrors = {};
      $scope.$watch('datasource.lastErrors', function() {
        $scope.target.datasourceErrors = $scope.datasource.lastErrors;
      }, true);
    };

    $scope.refreshMetricData = function() {
      $scope.target.errors = validateTarget($scope.target);
      $scope.calculateInterval();
      $scope.target.prometheusLink = $scope.linkToPrometheus();

      // this does not work so good
      if (!_.isEqual($scope.oldTarget, $scope.target) && _.isEmpty($scope.target.errors)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };

    $scope.inputMetric = function() {
      $scope.target.expr += $scope.target.metric;
      $scope.target.metric = '';
    };

    $scope.moveMetricQuery = function(fromIndex, toIndex) {
      _.move($scope.panel.targets, fromIndex, toIndex);
    };

    $scope.suggestMetrics = function(query, callback) {
      $scope.datasource
        .performSuggestQuery(query)
        .then(callback);
    };

    $scope.linkToPrometheus = function() {
      var from = dateMath.parse($scope.dashboard.time.from, false);
      var to = dateMath.parse($scope.dashboard.time.to, true);

      if ($scope.panel.timeFrom) {
        from = dateMath.parseDateMath('-' + $scope.panel.timeFrom, to, false);
      }
      if ($scope.panel.timeShift) {
        from = dateMath.parseDateMath('-' + $scope.panel.timeShift, from, false);
        to = dateMath.parseDateMath('-' + $scope.panel.timeShift, to, true);
      }

      var range = Math.ceil((to.valueOf()- from.valueOf()) / 1000);

      var endTime = to.format('YYYY-MM-DD HH:MM');

      var step = kbn.interval_to_seconds(this.target.calculatedInterval);
      if (step !== 0 && range / step > 11000) {
        step = Math.floor(range / 11000);
      }

      var expr = {
        expr: $scope.target.expr,
        range_input: range + 's',
        end_input: endTime,
        //step_input: step,
        step_input: '',
        stacked: $scope.panel.stack,
        tab: 0
      };

      var hash = encodeURIComponent(JSON.stringify([expr]));
      return $scope.datasource.url + '/graph#' + hash;
    };

    $scope.calculateInterval = function() {
      var interval = $scope.target.interval || $scope.interval;
      var calculatedInterval = $scope.datasource.calculateInterval(interval, $scope.target.intervalFactor);
      $scope.target.calculatedInterval = kbn.secondsToHms(calculatedInterval);
    };

    // TODO: validate target
    function validateTarget() {
      var errs = {};

      return errs;
    }

    $scope.init();
  });

});
