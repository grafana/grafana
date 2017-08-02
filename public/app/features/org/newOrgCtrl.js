define([
  'angular',
  'app/core/config',
  'lodash'
],
function (angular, config, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('NewOrgCtrl', function ($scope, backendSrv) {

    $scope.newOrg = {name: ''};
    $scope.newSystems = [{name: "默认系统"}];
    $scope.addSystem = function () {
      var index = $scope.newSystems.length + 1;
      $scope.newSystems.push({name: "默认系统" + index});
    };

    $scope.createOrg = function () {
      $scope.newOrg.systemsName = transposition($scope.newSystems);
      backendSrv.post('/api/orgs/', $scope.newOrg).then(function (result) {
        backendSrv.updateSystemsMap();
        backendSrv.post('/api/user/using/' + result.orgId).then(function () {
          window.location.href = config.appSubUrl + '/org';
        });
      });
    };

    function transposition(objArray) {
      var arr = [];
      _.each(objArray, function (system) {
        arr.push(system.name);
      });
      return arr;
    }
  });
});
