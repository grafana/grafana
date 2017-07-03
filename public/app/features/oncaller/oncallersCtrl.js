define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('OnCallersCtrl', function($scope, oncallerMgrSrv, alertSrv, backendSrv, contextSrv) {

    $scope.init = function() {
      oncallerMgrSrv.load().then(function onSuccess(response) {
        $scope.oncallerDefList = response.data;
        $scope.orgName = contextSrv.user.orgName;
      }, function onFailed(response) {
        $scope.err = response.message || "Request failed";
        $scope.status = response.status;
      });
    };
    $scope.getSystemName = function (id) {
      return backendSrv.getSystemById(id);
    };

    $scope.remove = function(oncallerOrg, oncallerService, oncallerId) {
      $scope.appEvent('confirm-modal', {
        title: '您确定要删除这个告警通知吗?',
        icon: 'fa-trash',
        yesText: 'Delete',
        onConfirm: function() {
          oncallerMgrSrv.remove(oncallerOrg, oncallerService, oncallerId).then(function onSuccess() {
            for (var i = $scope.oncallerDefList.length - 1; i >= 0; i--) {
              if (oncallerId === $scope.oncallerDefList[i].id) {
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

    $scope.init();
  });
});
