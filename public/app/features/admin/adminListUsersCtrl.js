define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AdminListUsersCtrl', function($scope, backendSrv) {

    $scope.init = function() {
      $scope.getUsers();
    };

    $scope.getUsers = function() {
      backendSrv.get('/api/users').then(function(users) {
        $scope.users = users;
      });
    };

    $scope.deleteUser = function(user) {
      $scope.appEvent('confirm-modal', {
        title: '您想删除' + user.login + ' 用户吗?',
        icon: 'fa-trash',
        yesText: '删除',
        onConfirm: function() {
          backendSrv.delete('/api/admin/users/' + user.id).then(function() {
            $scope.getUsers();
          });
        }
      });
    };

    $scope.init();

  });
});
