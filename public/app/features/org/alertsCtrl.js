define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertsCtrl', function($scope, alertMgrSrv, alertSrv) {

    $scope.init = function() {
      alertMgrSrv.load().then(function onSuccess(response) {
        $scope.alertDefList = response.data;
        $scope.exportJson = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(response.data));
      }, function onFailed(response) {
        $scope.err = response.message || "Request failed";
        $scope.status = response.status;
      });
    };

    $scope.remove = function(alertId) {
      $scope.appEvent('confirm-modal', {
        title: '您是否需要删除这个报警规则',
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

    $scope.importAlerts = function () {
      var modalScope = $scope.$new();
      $scope.appEvent('show-modal', {
        src: 'public/app/partials/import_alerts.html',
        modalClass: 'modal-no-header confirm-modal',
        scope: modalScope
      });
    };

    $scope.init();
  });
});
