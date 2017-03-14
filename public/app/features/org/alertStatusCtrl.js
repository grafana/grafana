define([
  'angular',
  'moment'
],
function (angular, moment) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertStatusCtrl', function ($scope, alertMgrSrv) {
    $scope.init = function () {
      $scope.correlationThreshold = 100;
      alertMgrSrv.loadTriggeredAlerts().then(function onSuccess(response) {
        for (var i = 0; i < response.data.length; i++) {
          var alertDetail = response.data[i];
          if (alertDetail.status.level === "CRITICAL") {
            alertDetail.definition.alertDetails.threshold = alertDetail.definition.alertDetails.crit.threshold;
          } else {
            alertDetail.definition.alertDetails.threshold = alertDetail.definition.alertDetails.warn.threshold;
          }
          // Only show 2 digits. +0.00001 is to avoid floating point weirdness on rounding number.
          alertDetail.status.triggeredValue = Math.round((alertDetail.status.triggeredValue + 0.00001) * 100) / 100;
        }
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

    $scope.handleSnooze = function(alertDetails) {
      var newScope = $scope.$new();
      newScope.alertDetails = alertDetails;
      $scope.appEvent('show-modal', {
        src: './app/partials/snooze_alert.html',
        modalClass: 'modal-no-header confirm-modal',
        scope: newScope
      });
    };
    $scope.random = function () {
      // There would be something problems when render the page;
      return Math.floor(Math.random() * 100) + 20;
    };

    $scope.formatDate = function (mSecond) {
      return moment(mSecond).format("YYYY-MM-DD HH:mm:ss");
    };

    $scope.timeFrom = function (mSecond, snoozeMin) {
      return moment(mSecond).add(snoozeMin, 'm').format("YYYY-MM-DD HH:mm");
    };

    $scope.init();
  });
});
