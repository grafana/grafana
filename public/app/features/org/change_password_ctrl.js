define([
  'angular',
  'app/core/config',
],
function (angular, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ChangePasswordCtrl', function($scope, backendSrv, $location, navModelSrv) {

    $scope.command = {};
    $scope.authProxyEnabled = config.authProxyEnabled;
    $scope.ldapEnabled = config.ldapEnabled;
    $scope.navModel = navModelSrv.getProfileNav();

    $scope.changePassword = function() {
      if (!$scope.userForm.$valid) { return; }

      if ($scope.command.newPassword !== $scope.command.confirmNew) {
        $scope.appEvent('alert-warning', ['New passwords do not match', '']);
        return;
      }

      backendSrv.put('/api/user/password', $scope.command).then(function() {
        $location.path("profile");
      });
    };

  });
});
