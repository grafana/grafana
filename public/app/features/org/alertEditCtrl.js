define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertEditCtrl', function($scope, $routeParams, $location, alertMgrSrv, alertSrv) {
    $scope.init = function() {
      $scope.alertDef = alertMgrSrv.get($routeParams.id);
      $scope.isNew = !$scope.alertDef;
    };

    $scope.saveChanges = function() {
      alertMgrSrv.save($scope.alertDef).then(function onSuccess() {
        $location.path("alerts");
      }, function onFailed(response) {
        alertSrv.set("error", response.status + " " + (response.data || "Request failed"), response.severity, 10000);
      });
    };

    $scope.init();
  });
});
