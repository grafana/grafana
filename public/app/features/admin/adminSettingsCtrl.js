define([
  'angular',
],
function (angular) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('AdminSettingsCtrl', function($scope, backendSrv) {

    $scope.init = function() {
      $scope.getUsers();
    };

    $scope.getUsers = function() {
      backendSrv.get('/api/admin/settings').then(function(settings) {
        $scope.settings = settings;
      });
    };

    $scope.init();

  });
});
