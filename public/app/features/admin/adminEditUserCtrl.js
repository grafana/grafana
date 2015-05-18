define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AdminEditUserCtrl', function($scope, $routeParams, backendSrv, $location) {
    $scope.user = {};
    $scope.permissions = {};

    $scope.init = function() {
      if ($routeParams.id) {
        $scope.getUser($routeParams.id);
      }
    };

    $scope.getUser = function(id) {
      backendSrv.get('/api/users/' + id).then(function(user) {
        $scope.user = user;
        $scope.user_id = id;
        $scope.permissions.isGrafanaAdmin = user.isGrafanaAdmin;
      });
    };

    $scope.setPassword = function () {
      if (!$scope.passwordForm.$valid) { return; }

      var payload = { password: $scope.password };
      backendSrv.put('/api/admin/users/' + $scope.user_id + '/password', payload).then(function() {
        $location.path('/admin/users');
      });
    };

    $scope.updatePermissions = function() {
      var payload = $scope.permissions;

      backendSrv.put('/api/admin/users/' + $scope.user_id + '/permissions', payload).then(function() {
        $location.path('/admin/users');
      });
    };

    $scope.create = function() {
      if (!$scope.userForm.$valid) { return; }

      backendSrv.post('/api/admin/users', $scope.user).then(function() {
        $location.path('/admin/users');
      });
    };

    $scope.update = function() {
      if (!$scope.userForm.$valid) { return; }

      backendSrv.put('/api/users/' + $scope.user_id, $scope.user).then(function() {
        $location.path('/admin/users');
      });
    };

    $scope.init();

  });
});
