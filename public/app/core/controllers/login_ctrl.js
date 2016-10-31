define([
  'angular',
  'lodash',
  '../core_module',
  'app/core/config',
],
function (angular, _, coreModule, config) {
  'use strict';

  coreModule.default.controller('LoginCtrl', function($scope, $cookies, backendSrv, contextSrv, $location) {
    $scope.formModel = {
      user: '',
      email: '',
      password: '',
    };

    contextSrv.sidemenu = false;

    $scope.oauth = config.oauth;
    $scope.oauthEnabled = _.keys(config.oauth).length > 0;

    $scope.disableLoginForm = config.disableLoginForm;
    $scope.disableUserSignUp = config.disableUserSignUp;
    $scope.loginHint     = config.loginHint;

    $scope.loginMode = true;
    $scope.submitBtnText = 'Log in';

    $scope.init = function() {
      $scope.$watch("loginMode", $scope.loginModeChanged);

      // cookie key from pkg/api/login_oauth.go:25
      var message = $cookies.get("grafana_last_error");
      if (message) {
        $scope.appEvent('alert-warning', ['Login Failed', message]);
        $cookies.remove("grafana_last_error");
      }
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

    $scope.signUp = function() {
      if (!$scope.loginForm.$valid) {
        return;
      }

      backendSrv.post('/api/user/signup', $scope.formModel).then(function(result) {
        if (result.status === 'SignUpCreated') {
          $location.path('/signup').search({email: $scope.formModel.email});
        } else {
          window.location.href = config.appSubUrl + '/';
        }
      });
    };

    $scope.login = function() {
      delete $scope.loginError;

      if (!$scope.loginForm.$valid) {
        return;
      }

      backendSrv.post('/login', $scope.formModel).then(function(result) {
        var params = $location.search();

        if (params.redirect && params.redirect[0] === '/') {
          window.location.href = config.appSubUrl + params.redirect;
        }
        else if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
        } else {
          window.location.href = config.appSubUrl + '/';
        }
      });
    };

    $scope.init();
  });
});
