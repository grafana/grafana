define([
  'angular',
  'config',
],
function (angular, config) {
  'use strict';

  var module = angular.module('grafana.controllers');

  module.controller('LoginCtrl', function($scope, backendSrv, contextSrv, $location) {
    $scope.formModel = {
      user: '',
      email: '',
      password: '',
    };

    contextSrv.sidemenu = false;

    $scope.googleAuthEnabled = config.googleAuthEnabled;
    $scope.githubAuthEnabled = config.githubAuthEnabled;
    $scope.disableUserSignUp = config.disableUserSignUp;

    $scope.loginMode = true;
    $scope.submitBtnClass = 'btn-inverse';
    $scope.submitBtnText = 'Log in';
    $scope.strengthClass = '';

    $scope.init = function() {
      $scope.$watch("loginMode", $scope.loginModeChanged);
      $scope.passwordChanged();

      var params = $location.search();
      if (params.failedMsg) {
        $scope.appEvent('alert-warning', ['Login Failed', params.failedMsg]);
        delete params.failedMsg;
        $location.search(params);
      }
    };

    // build info view model
    $scope.buildInfo = {
      version: config.buildInfo.version,
      commit: config.buildInfo.commit,
      buildstamp: new Date(config.buildInfo.buildstamp * 1000)
    };

    $scope.submit = function() {
      if ($scope.loginMode) {
        $scope.login();
      } else {
        $scope.signUp();
      }
    };

    $scope.loginModeChanged = function(newValue) {
      $scope.submitBtnText = newValue ? 'Log in' : 'Sign up';
    };

    $scope.passwordChanged = function(newValue) {
      if (!newValue) {
        $scope.strengthText = "";
        $scope.strengthClass = "hidden";
        return;
      }
      if (newValue.length < 4) {
        $scope.strengthText = "strength: weak sauce.";
        $scope.strengthClass = "password-strength-bad";
        return;
      }
      if (newValue.length <= 6) {
        $scope.strengthText = "strength: you can do better.";
        $scope.strengthClass = "password-strength-ok";
        return;
      }

      $scope.strengthText = "strength: strong like a bull.";
      $scope.strengthClass = "password-strength-good";
    };

    $scope.signUp = function() {
      if (!$scope.loginForm.$valid) {
        return;
      }

      backendSrv.post('/api/user/signup', $scope.formModel).then(function() {
        window.location.href = config.appSubUrl + '/';
      });
    };

    $scope.login = function() {
      delete $scope.loginError;

      if (!$scope.loginForm.$valid) {
        return;
      }

      backendSrv.post('/login', $scope.formModel).then(function(result) {
        if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
        } else {
          window.location.href = config.appSubUrl + '/';
        }
      });
    };

    $scope.init();

  });

});
