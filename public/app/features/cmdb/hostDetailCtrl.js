define([
  'angular',
  'lodash'
], function(angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('HostDetailCtrl', function ($scope, backendSrv, $location) {
    $scope.init = function() {
      var id = $location.search().id;
      console.log(id);
      // backendSrv.get('/cmdb/host?id='+id).then(function(response) {
      //   $scope.detail = response;
      // });

      $scope.detail = {
        "id": 116,
        "key": "fc80183386de68ad5b7f1cf75844ad8c",
        "createdAt": 1499312879000,
        "architecture": "x86_64",
        "biosDate": "11/08/2016",
        "biosVersion": "FWKT5FA",
        "totalMemory": 1269,
        "hostname": "server1",
        "domain": "",
        "fqdn": "server1",
        "defaultIp": "192.168.1.150",
        "osFamily": "Debian",
        "osName": "Ubuntu",
        "osVersion": "16.04",
        "productSerial": "MJ04QP3C",
        "productVersion": "ThinkCentre M700",
        "productUuid": "9530B958-B27E-11E6-9233-70E820D01C00",
        "productName": "10HYCTO1WW",
        "cpu": [
          "Intel(R) Core(TM) i7-6700T CPU @ 2.80GHz",
          "Intel(R) Core(TM) i7-6700T CPU @ 2.80GHz",
          "Intel(R) Core(TM) i7-6700T CPU @ 2.80GHz",
          "Intel(R) Core(TM) i7-6700T CPU @ 2.80GHz",
          "Intel(R) Core(TM) i7-6700T CPU @ 2.80GHz",
          "Intel(R) Core(TM) i7-6700T CPU @ 2.80GHz",
          "Intel(R) Core(TM) i7-6700T CPU @ 2.80GHz",
          "Intel(R) Core(TM) i7-6700T CPU @ 2.80GHz"
        ],
        "isVirtual": false,
        "devices": [
          {
            "id": 119,
            "key": "fc80183386de68ad5b7f1cf75844ad8c_device_sda",
            "createdAt": 1499312879000,
            "host": "SATA controller: Intel Corporation Sunrise Point-H SATA controller [AHCI mode] (rev 31)",
            "model": "ST500LM021-1KJ15",
            "vendor": "ATA",
            "size": "465.76 GB"
          }
        ],
        "interfaces": [
          {
            "id": 117,
            "key": "fc80183386de68ad5b7f1cf75844ad8c_interface_eno1",
            "createdAt": 1499312879000,
            "ip": "192.168.1.150",
            "mac": "00:23:24:c7:d3:a1",
            "speed": 100
          },
          {
            "id": 118,
            "key": "fc80183386de68ad5b7f1cf75844ad8c_interface_xenbr0",
            "createdAt": 1499312879000,
            "ip": "192.168.1.150",
            "mac": "00:23:24:c7:d3:a1",
            "speed": null
          }
        ]
      };

      $scope.cpuCount = _.countBy($scope.detail.cpu);
    };

    $scope.init();
  });
});