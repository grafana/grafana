define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('OnCallersCtrl', function($scope, oncallerMgrSrv, alertSrv) {
    oncallerMgrSrv.load().then(function onSuccess(response) {
      $scope.oncallerDefList = response.data;
    }, function onFailed(response) {
      $scope.err = response.message || "Request failed";
      $scope.status = response.status;
    });

    $scope.remove = function(oncallerService) {
      $scope.appEvent('confirm-modal', {
        title: 'Are you sure you want to delete this oncaller?',
        icon: 'fa-trash',
        yesText: 'Delete',
        onConfirm: function() {
          oncallerMgrSrv.remove(oncallerService).then(function onSuccess() {
            for (var i = $scope.oncallerDefList.length - 1; i >= 0; i--) {
              if (oncallerService === $scope.oncallerDefList[i].service) {
                $scope.oncallerDefList.splice(i, 1);
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
