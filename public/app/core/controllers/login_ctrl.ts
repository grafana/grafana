import _ from 'lodash';
import coreModule from '../core_module';
import config from 'app/core/config';

export class LoginCtrl {
  /** @ngInject */
  constructor($scope, backendSrv, contextSrv, $location) {
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
    $scope.loginHint = config.loginHint;

    $scope.loginMode = true;
    $scope.submitBtnText = 'Log in';

    $scope.init = function() {
      $scope.$watch('loginMode', $scope.loginModeChanged);

      if (config.loginError) {
        $scope.appEvent('alert-warning', ['Login Failed', config.loginError]);
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

      backendSrv
        .post('/api/user/signup', $scope.formModel)
        .then(function(result) {
          if (result.status === 'SignUpCreated') {
            $location.path('/signup').search({ email: $scope.formModel.email });
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
        } else if (result.redirectUrl) {
          window.location.href = result.redirectUrl;
        } else {
          window.location.href = config.appSubUrl + '/';
        }
      });
    };

    $scope.init();
  }
}

coreModule.controller('LoginCtrl', LoginCtrl);
