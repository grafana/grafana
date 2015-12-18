define([
  'angular',
  'app/core/config',
],
function (angular, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AppsCtrl', function($scope, $location, appSrv) {

    $scope.init = function() {
      $scope.apps = {};
      $scope.getApps();
    };

    $scope.getApps = function() {
      appSrv.getAll().then(function(result) {
        $scope.apps = result;
      });
    };

    $scope.update = function(app) {
      appSrv.update(app).then(function() {
        window.location.href = config.appSubUrl + $location.path();
      });
    };

    $scope.init();

  });
});