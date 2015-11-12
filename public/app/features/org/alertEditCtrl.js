define([
  'angular',
  'lodash',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AlertEditCtrl', function($scope, $routeParams, alertMgrSrv) {
    $scope.init = function() {
      $scope.alertDef = alertMgrSrv.get($routeParams.id);
      $scope.isNew = !$scope.alertDef;
    };

    $scope.saveChanges() = function() {
    };

    $scope.init();
  });
});
