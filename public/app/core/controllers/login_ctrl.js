define([
  'angular',
  '../core_module',
  'app/core/config',
],
function (angular, coreModule, config) {
  'use strict';

  coreModule.controller('LoginCtrl', function($scope, backendSrv, contextSrv, $location) {
    $scope.formModel = {
      user: '',
      email: '',
      password: '',
    };

    contextSrv.sidemenu = false;

    $scope.googleAuthEnabled = config.googleAuthEnabled;
    $scope.githubAuthEnabled = config.githubAuthEnabled;
    $scope.disableUserSignUp = config.disableUserSignUp;
    $scope.loginHint     = config.loginHint;

    $scope.loginMode = true;
    $scope.submitBtnText = 'Log in';

    $scope.init = function() {
      $scope.$watch("loginMode", $scope.loginModeChanged);

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
