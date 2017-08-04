define([
  'angular',
  'lodash'
], function(angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('CMDBSetupCtrl', function ($scope, backendSrv, $location, contextSrv) {
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
      try{
        for(var os in cmdbHosts) {
          if(!(cmdbHosts[os].hosts && _.isArray(cmdbHosts[os].hosts))) {
            var err = {message: "文件格式错误"}
            throw err;
          }
        }
      } catch (err) {
        $scope.appEvent('alert-error', [err.message]);
        return;
      }
      backendSrv.uploadHostList(cmdbHosts, '/cmdb/setting').then(function(response) {
        if(response.status == 200) {
          $scope.appEvent('alert-success', ['上传成功']);
        }
      });
    };

    $scope.getService = function() {
      backendSrv.alertD({url: '/cmdb/setting/software'}).then(function (response) {
        console.log(response.data);
        var software = _.find(response.data, {'orgId': contextSrv.user.orgId, 'sysId': contextSrv.user.systemId});
        var helpInfo = {
          "name": "请输入服务名称",
          "platform": "请输入'windows'或者'linux'",
          "command": "请输入指令"
        };
        if(_.isEmpty(software)) {
          software = [helpInfo];
        } else {
          software = software.software;
          software.unshift(helpInfo);
        }
        var blob = new Blob([angular.toJson(software, true)], { type: "application/json;charset=utf-8" });
        window.saveAs(blob, 'service-' + new Date().getTime());
      });
    };

    $scope.importService = function() {
      backendSrv.uploadHostList(cmdbHosts, '/cmdb/setting/software').then(function(response) {
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