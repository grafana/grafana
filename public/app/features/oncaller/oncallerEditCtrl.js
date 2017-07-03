define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('OnCallerEditCtrl', function($scope, $routeParams, $location, oncallerMgrSrv, alertSrv, contextSrv, backendSrv) {

    $scope.init = function() {
      $scope.oncallerDef = oncallerMgrSrv.get($routeParams.id) || {};
      $scope.isNew = !Object.keys($scope.oncallerDef).length;
      $scope.oncallerDef.org = contextSrv.user.orgId;
      $scope.oncallerDef.service = contextSrv.user.systemId;
      $scope.orgName = contextSrv.user.orgName;
      $scope.serviceName = backendSrv.getSystemById(contextSrv.user.systemId);
    };

    $scope.saveChanges = function() {
      oncallerMgrSrv.save($scope.oncallerDef).then(function onSuccess() {
        $location.path("oncallers");
      }, function onFailed(response) {
        alertSrv.set("error", response.status + " " + (response.data || "Request failed"), response.severity, 10000);
      });
    };

    $scope.init();
  });
});
