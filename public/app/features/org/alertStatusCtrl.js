define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertStatusCtrl', function ($scope, alertMgrSrv) {
    var alertRows = [];

    $scope.init = function () {
      $scope.correlationThreshold = 100;
      alertMgrSrv.loadTriggeredAlerts().then(function onSuccess(response) {
        $scope.alertRows = response.data;
        for (var i = 0; i < response.data.length; i++) {
          alertRows.push({height: '250px', panels: [], triggeredAlert: response.data[i]});
        }
        $scope.initDashboard({
          meta: {canStar: false, canShare: false, canEdit: false},
          dashboard: {
            title: "触发报警",
            rows: alertRows,
            time: {from: "now-2h", to: "now"}
          },
        }, $scope);
      });
    };
    $scope.init();
  });
});
