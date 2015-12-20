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

    alertMgrSrv.loadAssociatedMetrics(alertId).then(function onSuccess(response) {
      var correlationOfAlertMap = response.data;

      for (var host in correlationOfAlertMap) {
        var correlatedMetrics = correlationOfAlertMap[host].metrics;
        for (var m in correlatedMetrics) {
          associatedMetricRows.push(
            { height: '250px',
              panels:[],
              associatedMetric: {
                metric: m,
                hosts: correlatedMetrics[m]
              }
            });
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

  });
});
