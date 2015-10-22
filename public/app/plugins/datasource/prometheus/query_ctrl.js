define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('PrometheusQueryCtrl', function($scope) {

    $scope.init = function() {
      var target = $scope.target;

      target.expr = target.expr || '';
      target.intervalFactor = target.intervalFactor || 2;
      target.prometheusLink = $scope.linkToPrometheus();

      $scope.metric = '';
      $scope.resolutions = _.map([1,2,3,4,5,10], function(f) {
        return {factor: f, label: '1/' + f};
      });

      $scope.$on('typeahead-updated', function() {
        $scope.$apply($scope.inputMetric);
        $scope.refreshMetricData();
      });
    };

    $scope.refreshMetricData = function() {
      $scope.target.prometheusLink = $scope.linkToPrometheus();
      if (!_.isEqual($scope.oldTarget, $scope.target)) {
        $scope.oldTarget = angular.copy($scope.target);
        $scope.get_data();
      }
    };

    $scope.inputMetric = function() {
      $scope.target.expr += $scope.target.metric;
      $scope.metric = '';
    };

    $scope.suggestMetrics = function(query, callback) {
      $scope.datasource
        .performSuggestQuery(query)
        .then(callback);
    };

<<<<<<< 6bf82c03b34a8bebe22aadd263e1da368a1ff4a4
<<<<<<< 4f3b5b91e26289c325a2a4692c49d78e9435bddc
=======
>>>>>>> revert prometheus link
    $scope.linkToPrometheus = function() {
      var range = Math.ceil(($scope.range.to.valueOf() - $scope.range.from.valueOf()) / 1000);
      var endTime = $scope.range.to.utc().format('YYYY-MM-DD HH:MM');
      var expr = {
        expr: $scope.target.expr,
        range_input: range + 's',
        end_input: endTime,
        step_input: '',
        stacked: $scope.panel.stack,
        tab: 0
      };
      var hash = encodeURIComponent(JSON.stringify([expr]));
      return $scope.datasource.directUrl + '/graph#' + hash;
    };

<<<<<<< 6bf82c03b34a8bebe22aadd263e1da368a1ff4a4
=======
>>>>>>> feat(prometheus): refactoring and polish of the prometheus editor removing unused/uneeded code
=======
>>>>>>> revert prometheus link
    $scope.init();
  });

});
