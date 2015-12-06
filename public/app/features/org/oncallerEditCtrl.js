define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('OnCallerEditCtrl', function($scope, $routeParams, $location, oncallerMgrSrv, oncallerSrv) {

    $scope.init = function() {
      $scope.oncallerDef = oncallerMgrSrv.get($routeParams.id);
      $scope.isNew = !$scope.oncallerDef;
      if ($scope.isNew) {
      }
    };

    $scope.saveChanges = function() {
      if ($scope.isNew) {
        //if it is new, we need to fill in some hard-coded value for now.
      }

      oncallerMgrSrv.save($scope.oncallerDef).then(function onSuccess() {
        $location.path("oncallers");
      }, function onFailed(response) {
        oncallerSrv.set("error", response.status + " " + (response.data || "Request failed"), response.severity, 10000);
      });
    };

    $scope.init();
  });
});
