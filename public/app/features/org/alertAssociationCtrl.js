define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertAssociationCtrl', function($scope, $routeParams, alertMgrSrv) {
    var associatedMetricRows = [];
    var alertId = $routeParams.id;

    $scope.init = function() {
      alertMgrSrv.loadAssociatedMetrics(alertId).then(function onSuccess(response) {
        var correlationOfAlertMap = response.data;

        for (var host in correlationOfAlertMap) {
          var correlatedMetrics = correlationOfAlertMap[host].metrics;
          var normalizedMetricMap = {};

          for (var m in correlatedMetrics) {
            var s = m.split(".");
            var postfix = s[s.length-1];
            if (postfix === 'min' ||
                postfix === 'max' ||
                postfix === 'p99' ||
                postfix === 'p999') {
              var normalizedMetric = s.slice(0, s.length-1).join(".");
              if (normalizedMetric in normalizedMetricMap) {
                normalizedMetricMap[normalizedMetric].push(
                  {
                    metric: m,
                    hosts: correlatedMetrics[m]
                  });
              } else {
                normalizedMetricMap[normalizedMetric] = [
                {
                  metric: m,
                  hosts: correlatedMetrics[m]
                }];
              }
            } else {
              if (m in normalizedMetricMap) {
                normalizedMetricMap[m].push(
                  {
                    metric: m,
                    hosts: correlatedMetrics[m]
                  });
              } else {
                normalizedMetricMap[m] = [
                  {
                    metric: m,
                    hosts: correlatedMetrics[m]
                  }];
              }
            }
          }

          for (var metric in normalizedMetricMap) {
            var oneRow = {};
            oneRow.height = '250px';
            oneRow.panels = [];
            oneRow.associatedMetrics = normalizedMetricMap[metric];
            associatedMetricRows.push(oneRow);
          }
        }

        $scope.initDashboard({
          meta: { canStar: false, canShare: false, canEdit: false },
          dashboard: {
            title: "Associated Metrics",
            rows: associatedMetricRows,
            time: {from: "now-2h", to: "now"}
          },
        }, $scope);
      });
    };
  });
});
