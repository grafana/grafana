define([
    'angular',
  ],
  function (angular) {
    'use strict';

    var module = angular.module('grafana.controllers');

    module.controller('OrgDetailsCtrl', function ($scope, backendSrv, contextSrv) {

      $scope.init = function () {
        $scope.getOrgInfo();
      };

      $scope.getOrgInfo = function () {
        backendSrv.get('/api/org').then(function (org) {
          $scope.org = org;
          $scope.address = org.address;
          $scope.systems = org.systems;
          $scope.newSystemName = "";
          contextSrv.user.orgName = org.name;
        });
      };

      $scope.update = function () {
        if (!$scope.orgForm.$valid) {
          return;
        }
        var data = {name: $scope.org.name};
        backendSrv.put('/api/org', data).then(function () {
          $scope.getOrgInfo;
        });
      };

      $scope.updateAddress = function () {
        if (!$scope.addressForm.$valid) {
          return;
        }
        backendSrv.put('/api/org/address', $scope.address).then(function () {
          $scope.getOrgInfo();
        });
      };

      $scope.updateSystems = function () {
        backendSrv.put('/api/org/system', {System: $scope.systems}).then(function () {
          backendSrv.updateSystemsMap();
        });
      };

      $scope.addSystem = function () {
        backendSrv.post('/api/org/system', {SystemsName: [$scope.newSystemName]}).then(function () {
          $scope.getOrgInfo();
          backendSrv.updateSystemsMap();
        });
      };

      $scope.init();

    });
  });
