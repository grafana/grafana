define([
  'angular',
  'lodash'
], function(angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('CMDBSetupCtrl', function ($scope, backendSrv, $location) {
    $scope.getHost = function() {
      backendSrv.alertD({url: '/cmdb/setting'}).then(function (response) {
        var data = response.data;
        var file = {
          hosts: data.hosts,
          remoteUser : data.remoteUser
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