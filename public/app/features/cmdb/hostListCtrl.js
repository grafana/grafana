define([
  'angular',
  'lodash'
], function(angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('HostListCtrl', function ($scope, backendSrv, $location) {
    $scope.init = function() {
      $scope.searchHost = '';
      // backendSrv.get('/cmdb/host').then(function(result) {
      //   $scope.hosts = result.data;
      // });

      $scope.hosts = [
        {
          "id": 116,
          "key": "fc80183386de68ad5b7f1cf75844ad8c",
          "architecture": null,
          "biosDate": null,
          "biosVersion": null,
          "totalMemory": 0,
          "hostname": "server1",
          "domain": null,
          "fqdn": null,
          "defaultIp": "192.168.1.150",
          "osFamily": null,
          "osName": null,
          "osVersion": null,
          "productSerial": null,
          "productVersion": null,
          "productUuid": null,
          "productName": null,
          "cpu": null,
          "isVirtual": false,
          "createdAt": 1499312879000
        },
        {
          "id": 117,
          "key": "fc80183386de68ad5b7f1cf75844ad8c",
          "architecture": null,
          "biosDate": null,
          "biosVersion": null,
          "totalMemory": 0,
          "hostname": "server1",
          "domain": null,
          "fqdn": null,
          "defaultIp": "192.168.1.150",
          "osFamily": null,
          "osName": null,
          "osVersion": null,
          "productSerial": null,
          "productVersion": null,
          "productUuid": null,
          "productName": null,
          "cpu": null,
          "isVirtual": true,
          "createdAt": 1499312879000
        },
        {
          "id": 118,
          "key": "fc80183386de68ad5b7f1cf75844ad8c",
          "architecture": null,
          "biosDate": null,
          "biosVersion": null,
          "totalMemory": 0,
          "hostname": "server1",
          "domain": null,
          "fqdn": null,
          "defaultIp": "192.168.1.150",
          "osFamily": null,
          "osName": null,
          "osVersion": null,
          "productSerial": null,
          "productVersion": null,
          "productUuid": null,
          "productName": null,
          "cpu": null,
          "isVirtual": null,
          "createdAt": 1499312879000
        },
        {
          "id": 119,
          "key": "fc80183386de68ad5b7f1cf75844ad8c",
          "architecture": null,
          "biosDate": null,
          "biosVersion": null,
          "totalMemory": 0,
          "hostname": "server1",
          "domain": null,
          "fqdn": null,
          "defaultIp": "192.168.1.150",
          "osFamily": null,
          "osName": null,
          "osVersion": null,
          "productSerial": null,
          "productVersion": null,
          "productUuid": null,
          "productName": null,
          "cpu": null,
          "isVirtual": false,
          "createdAt": 1499312879000
        },
        {
          "id": 110,
          "key": "fc80183386de68ad5b7f1cf75844ad8c",
          "architecture": null,
          "biosDate": null,
          "biosVersion": null,
          "totalMemory": 0,
          "hostname": "server1",
          "domain": null,
          "fqdn": null,
          "defaultIp": "192.168.1.150",
          "osFamily": null,
          "osName": null,
          "osVersion": null,
          "productSerial": null,
          "productVersion": null,
          "productUuid": null,
          "productName": null,
          "cpu": null,
          "isVirtual": false,
          "createdAt": 1499312879000
        }
      ]

      _.map($scope.hosts, function(host) {
        if(host.isVirtual) {
          return host.isVirtual = '是';
        } else if(host.isVirtual == false) {
          return host.isVirtual = '否';
        } else {
          return host.isVirtual = '未知';
        }
      })
    };

    $scope.getDetail = function(host) {
      $location.url('/cmdb/hostlist/hostdetail?id='+host.id);
    };

    $scope.importList = function() {
      var newScope = $scope.$new();
      newScope.importHosts = $scope.importHosts;
      $scope.appEvent('show-modal', {
        src: 'app/features/cmdb/partials/import_host.html',
        modalClass: 'cmdb-import-host',
        scope: newScope,
      });
    };

    $scope.importHosts = function() {
      console.log('importHosts');
    };

    $scope.init();
  });
});