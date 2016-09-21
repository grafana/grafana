define([
  'angular',
  '../core_module',
  'app/core/config',
],
function (angular, coreModule, config) {
  'use strict';

  var failCodes = {
    "1000": "Required Github team membership not fulfilled",
    "1001": "Required Github organization membership not fulfilled",
    "1002": "Required email domain not fulfilled",
  };

  coreModule.default.controller('LoginCtrl', function($scope, backendSrv, contextSrv, $location) {
    $scope.formModel = {
      user: '',
      email: '',
      password: '',
    };

    contextSrv.sidemenu = false;

    $scope.googleAuthEnabled = config.googleAuthEnabled;
    $scope.githubAuthEnabled = config.githubAuthEnabled;
    $scope.grafanaNetAuthEnabled = config.grafanaNetAuthEnabled;
    $scope.oauthEnabled = (
      config.githubAuthEnabled
      || config.googleAuthEnabled
      || config.grafanaNetAuthEnabled
      || config.genericOAuthEnabled
    );
    $scope.allowUserPassLogin = config.allowUserPassLogin;
    $scope.genericOAuthEnabled = config.genericOAuthEnabled;
    $scope.oauthProviderName = config.oauthProviderName;
    $scope.disableUserSignUp = config.disableUserSignUp;
    $scope.loginHint     = config.loginHint;

    $scope.loginMode = true;
    $scope.submitBtnText = 'Log in';

    $scope.init = function() {
      $scope.$watch("loginMode", $scope.loginModeChanged);

      var params = $location.search();
      if (params.failCode) {
        $scope.appEvent('alert-warning', ['Login Failed', failCodes[params.failCode]]);
        delete params.failedMsg;
        $location.search(params);
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
