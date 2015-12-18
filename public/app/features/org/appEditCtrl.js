define([
  'angular',
  'lodash',
  'app/core/config',
],
function (angular, _, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AppEditCtrl', function($scope, appSrv, $routeParams) {
    $scope.init = function() {
      $scope.current = {};
      $scope.getApps();
    };

    $scope.getApps = function() {
      appSrv.get($routeParams.type).then(function(result) {
        $scope.current = _.clone(result);
      });
    };

    $scope.update = function() {
      $scope._update();
    };

    $scope._update = function() {
      appSrv.update($scope.current).then(function() {
        window.location.href = config.appSubUrl + "org/apps";
      });
    };

    $scope.init();
  });
});