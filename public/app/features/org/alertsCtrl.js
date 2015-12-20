define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertsCtrl', function($scope, alertMgrSrv, alertSrv) {
    alertMgrSrv.load().then(function onSuccess(response) {
      $scope.alertDefList = response.data;
    }, function onFailed(response) {
      $scope.err = response.message || "Request failed";
      $scope.status = response.status;
    });

    $scope.remove = function(alertId) {
      $scope.appEvent('confirm-modal', {
        title: 'Are you sure you want to delete this alert?',
        icon: 'fa-trash',
        yesText: 'Delete',
        onConfirm: function() {
          alertMgrSrv.remove(alertId).then(function onSuccess() {
            for (var i = $scope.alertDefList.length - 1; i >= 0; i--) {
              if (alertId === $scope.alertDefList[i].id) {
                $scope.alertDefList.splice(i, 1);
                break;
              }
            }
          }, function onFailed(response) {
            alertSrv.set("error", response.status + " " + (response.data || "Request failed"), response.severity, 10000);
          });
        }
      });
    };
  });
});
