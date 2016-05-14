define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertAssociationCtrl', function($scope, $routeParams, $location, alertMgrSrv) {
    var associatedMetricRows = [];
    var alertId = $routeParams.id;
    var distance = $routeParams.distance;

    alertMgrSrv.loadAssociatedMetrics(alertId, distance).then(function onSuccess(response) {
      var correlationOfAlertMap = response.data;

      for (var host in correlationOfAlertMap) {
        var correlatedMetrics = correlationOfAlertMap[host];
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
          id: alertId,
          rows: associatedMetricRows,
          time: {from: "now-2h", to: "now"}
        },
      }, $scope);
    });

    $scope.resetCorrelation = function() {
      $scope.correlationThreshold = 100; // reset the threshold to default value
      alertMgrSrv.resetCorrelation(alertId, $scope.correlationBefore, $scope.correlationAfter).then(function onSuccess() {
        $location.path("alerts/association/" + alertId + "/" + $scope.correlationThreshold);
      }, function onFailed(response) {
        alertSrv.set("error", response.status + " " + (response.data || "Request failed"), response.severity, 10000);
      });
    };

  });
});
