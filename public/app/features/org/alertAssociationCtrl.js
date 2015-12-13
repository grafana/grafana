define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertAssociationCtrl', function($scope, $routeParams, alertMgrSrv) {
    var associatedMetricRows = [];
    /*
    alertMgrSrv.loadAssociatedMetrics($routeParams.id).then(function onSuccess(response) {

      //for (var i = 0; i < response.data.length; i++) {
      //  associatedMetricRows.push({ height: '250px', panels:[], associatedMetric: response.data[i]});
      //}

      $scope.initDashboard({
        meta: { canStar: false, canShare: false, canEdit: false },
        dashboard: {
          title: "Associated Metrics",
          rows: associatedMetricRows,
          time: {from: "now-2h", to: "now"}
        },
      }, $scope);
    });
    */
    //var alertDef = alertMgrSrv.get($routeParams.id);
    //var alertMetric = alertDef.alertDetails.hostQuery.metricQueries[0].metric;
    //associatedMetricRows.push({ height: '250px', panels:[], associatedMetric: alertMetric});

    // Mock some response now
    associatedMetricRows.push({ height: '250px', panels:[], associatedMetric: "cloudmon-read-latency.p99"});
    associatedMetricRows.push({ height: '250px', panels:[], associatedMetric: "cloudmon-read-latency.p999"});

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
