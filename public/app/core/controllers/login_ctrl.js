define([
  'angular',
  '../core_module',
  'app/core/config',
],
function (angular, coreModule, config) {
  'use strict';

  coreModule.default.controller('LoginCtrl', function($scope, backendSrv, contextSrv, $location) {
    $scope.formModel = {
      user: '',
      email: '',
      password: '',
    };

    contextSrv.sidemenu = false;

    $scope.googleAuthEnabled = config.googleAuthEnabled;
    $scope.githubAuthEnabled = config.githubAuthEnabled;
    $scope.oauthEnabled = config.githubAuthEnabled || config.googleAuthEnabled;
    $scope.disableUserSignUp = config.disableUserSignUp;
    $scope.loginHint     = config.loginHint;

    $scope.loginMode = true;
    $scope.submitBtnText = '登 录';

    $scope.init = function() {
      $scope.$watch("loginMode", $scope.loginModeChanged);

      var params = $location.search();
      if (params.failedMsg) {
        $scope.appEvent('alert-warning', ['登录 失败', params.failedMsg]);
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
      $scope.login();
    };

    $scope.loginModeChanged = function(newValue) {
      $scope.submitBtnText = newValue ? '登 录' : '注 册';
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
          window.location.href = config.appSubUrl + '/systems';
        }
      });
    };

    $scope.contactUs = function() {
      $scope.appEvent('confirm-modal', {
        title: '欢迎与我们联系',
        text: '请致电：17070866703 <br/>邮 件：service@cloudwiz.cn',
        icon: 'fa-bell',
        yesText: '确定',
        noText: '关闭',
        modalClass : 'contact-us',
      });
    };

    $scope.init();
  });
});
