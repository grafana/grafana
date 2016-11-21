define([
  'angular',
  'lodash',
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
    $scope.resetCurrentThreshold = function (alertDetails) {
      alertMgrSrv.resetCurrentThreshold(alertDetails);
    };

    $scope.handleAlert = function () {
      $scope.appEvent('show-modal', {
        src: './app/partials/handle_alert.html',
        modalClass: 'modal-no-header confirm-modal',
        scope: $scope.$new()
      });
    };

    $scope.random = function () {
      // There would be something problems when render the page;
      return Math.floor(Math.random() * 100) + 20;
    };

    $scope.init();
  });
});
