define([
  'angular',
  'lodash'
], function(angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('CMDBSetupCtrl', function ($scope, backendSrv, $location) {
    $scope.getHost = function() {
      backendSrv.alertD({url: '/cmdb/setting'}).then(function (response) {
        var data = response.data || {};
        var linux = data.linux || {};
        var windows = data.windows || {};
        var file = {
          linux: {
            hosts: linux.hosts || ["请在此输入IP地址"],
            remoteUser : linux.remoteUser || "root"
          },
          windows: {
            hosts: windows.hosts || ["请在此输入IP地址"],
            remoteUser : windows.remoteUser || "Administrator",
            password: windows.password || "请输入密码"
          }
        };
        var blob = new Blob([angular.toJson(file, true)], { type: "application/json;charset=utf-8" });
        window.saveAs(blob, 'host-' + new Date().getTime());
      });
    };

    $scope.importHosts = function() {
      backendSrv.uploadHostList(cmdbHosts).then(function(response) {
        if(response.status == 200) {
          $scope.appEvent('alert-success', ['上传成功']);
        }
      });
    };

    $scope.fileChanged = function(ele) {
      $scope.fileName = ele.files[0].name;
      $scope.$apply();
    }
  });
});