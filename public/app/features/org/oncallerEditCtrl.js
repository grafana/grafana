define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('OnCallerEditCtrl', function($scope, $routeParams, $location, oncallerMgrSrv, alertSrv) {

    $scope.init = function() {
      $scope.oncallerDef = oncallerMgrSrv.get($routeParams.id);
      $scope.isNew = !$scope.oncallerDef;
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
