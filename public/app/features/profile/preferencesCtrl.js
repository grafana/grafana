define([
  'angular',
  'app/core/config',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('PreferencesCtrl', function($scope, backendSrv, $location) {

    $scope.command = {};

    $scope.setUserPreferences = function() {
      if (!$scope.userForm.$valid) { return; }

      console.log($scope.command);

      backendSrv.put('/api/user/prefs', $scope.command).then(function() {
        $location.path("profile");
      });
    };

  });
});
