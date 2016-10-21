define([
  'angular'
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertStatusCtrl', function ($scope, alertMgrSrv) {
    $scope.init = function () {
      $scope.correlationThreshold = 100;
      alertMgrSrv.loadTriggeredAlerts().then(function onSuccess(response) {
        $scope.alertRows = response.data;
      });
    };
    $scope.init();
  });
});
