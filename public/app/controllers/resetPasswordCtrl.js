define([
  'angular',
  'app',
  'lodash'
],
function (angular, app, _) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('ResetPasswordCtrl', function($scope, contextSrv, backendSrv) {

    contextSrv.sidemenu = false;
    $scope.sendMode = true;
    $scope.formModel = {};

    $scope.sendResetEmail = function() {
      if (!$scope.loginForm.$valid) {
        return;
      }

      backendSrv.post('/api/user/password/send-reset-email', $scope.formModel).then(function() {
      });
    };

  });

});
