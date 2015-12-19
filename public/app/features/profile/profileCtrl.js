define([
  'angular',
  'config',
],
function (angular, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ProfileCtrl', function($scope, backendSrv, contextSrv, $location) {

    $scope.init = function() {
      $scope.getUser();
      $scope.getUserOrgs();
    };

    $scope.getUser = function() {
      backendSrv.get('/api/user').then(function(user) {
        $scope.user = user;
        $scope.user.theme = user.theme || 'light';
        $scope.old_theme = $scope.user.theme;
      });
    };

    $scope.getUserOrgs = function() {
      backendSrv.get('/api/user/orgs').then(function(orgs) {
        $scope.orgs = orgs;
      });
    };

    $scope.setUsingOrg = function(org) {
      backendSrv.post('/api/user/using/' + org.orgId).then(function() {
        window.location.href = config.appSubUrl + '/profile';
      });
    };

    $scope.update = function() {
      if (!$scope.userForm.$valid) { return; }

      backendSrv.put('/api/user/', $scope.user).then(function() {
        contextSrv.user.name = $scope.user.name || $scope.user.login;
        if ($scope.old_theme !== $scope.user.theme) {
          window.location.href = config.appSubUrl + $location.path();
        }
      });
    };

    $scope.init();

  });
});
