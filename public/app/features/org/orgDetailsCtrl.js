define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('OrgDetailsCtrl', function($scope, $http, backendSrv, contextSrv, navModelSrv) {

    $scope.init = function() {
      $scope.getOrgInfo();
      $scope.navModel = navModelSrv.getOrgNav(0);
    };

    $scope.getOrgInfo = function() {
      backendSrv.get('/api/org').then(function(org) {
        $scope.org = org;
        $scope.address = org.address;
        contextSrv.user.orgName = org.name;
      });
    };

    $scope.update = function() {
      if (!$scope.orgForm.$valid) { return; }
      var data = {name: $scope.org.name};
      backendSrv.put('/api/org', data).then($scope.getOrgInfo);
    };

    $scope.updateAddress = function() {
      if (!$scope.addressForm.$valid) { return; }
      backendSrv.put('/api/org/address', $scope.address).then($scope.getOrgInfo);
    };

    $scope.init();

  });
});
