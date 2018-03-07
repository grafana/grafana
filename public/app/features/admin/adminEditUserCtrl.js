define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AdminEditUserCtrl', function($scope, $routeParams, backendSrv, $location, navModelSrv) {
    $scope.user = {};
    $scope.newOrg = { name: '', role: 'Editor' };
    $scope.permissions = {};
    $scope.navModel = navModelSrv.getAdminNav();

    $scope.init = function() {
      if ($routeParams.id) {
        $scope.getUser($routeParams.id);
        $scope.getUserOrgs($routeParams.id);
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

    $scope.getUserOrgs = function(id) {
      backendSrv.get('/api/users/' + id + '/orgs').then(function(orgs) {
        $scope.orgs = orgs;
      });
    };

    $scope.update = function() {
      if (!$scope.userForm.$valid) { return; }

      backendSrv.put('/api/users/' + $scope.user_id, $scope.user).then(function() {
        $location.path('/admin/users');
      });
    };

    $scope.updateOrgUser= function(orgUser) {
      backendSrv.patch('/api/orgs/' + orgUser.orgId + '/users/' + $scope.user_id, orgUser).then(function() {
      });
    };

    $scope.removeOrgUser = function(orgUser) {
      backendSrv.delete('/api/orgs/' + orgUser.orgId + '/users/' + $scope.user_id).then(function() {
        $scope.getUserOrgs($scope.user_id);
      });
    };

    $scope.orgsSearchCache = [];

    $scope.searchOrgs = function(queryStr, callback) {
      if ($scope.orgsSearchCache.length > 0) {
        callback(_.map($scope.orgsSearchCache, "name"));
        return;
      }

      backendSrv.get('/api/orgs', {query: ''}).then(function(result) {
        $scope.orgsSearchCache = result;
        callback(_.map(result, "name"));
      });
    };

    $scope.addOrgUser = function() {
      if (!$scope.addOrgForm.$valid) { return; }

      var orgInfo = _.find($scope.orgsSearchCache, {name: $scope.newOrg.name});
      if (!orgInfo) { return; }

      $scope.newOrg.loginOrEmail = $scope.user.login;

      backendSrv.post('/api/orgs/' + orgInfo.id + '/users/', $scope.newOrg).then(function() {
        $scope.getUserOrgs($scope.user_id);
      });
    };

    $scope.init();

  });
});
