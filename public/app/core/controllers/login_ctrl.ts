import _ from 'lodash';
import coreModule from '../core_module';
import config from 'app/core/config';
import { BackendSrv } from '../services/backend_srv';

export class LoginCtrl {
  /** @ngInject */
  constructor($scope: any, backendSrv: BackendSrv, $location: any) {
    $scope.formModel = {
      user: '',
      email: '',
      password: '',
    };

    $scope.command = {};
    $scope.result = '';
    $scope.loggingIn = false;

    $scope.oauth = config.oauth;
    $scope.oauthEnabled = _.keys(config.oauth).length > 0;
    $scope.ldapEnabled = config.ldapEnabled;
    $scope.authProxyEnabled = config.authProxyEnabled;

    $scope.disableLoginForm = config.disableLoginForm;
    $scope.disableUserSignUp = config.disableUserSignUp;
    $scope.loginHint = config.loginHint;
    $scope.passwordHint = config.passwordHint;

    $scope.loginMode = true;
    $scope.submitBtnText = 'Log in';

    $scope.init = () => {
      $scope.$watch('loginMode', $scope.loginModeChanged);

      if (config.loginError) {
        $scope.appEvent('alert-warning', ['Login Failed', config.loginError]);
      }
    };

    $scope.submit = () => {
      if ($scope.loginMode) {
        $scope.login();
      } else {
        $scope.signUp();
      }
    };

    $scope.changeView = () => {
      const loginView = document.querySelector('#login-view');
      const changePasswordView = document.querySelector('#change-password-view');

      loginView.className += ' add';
      setTimeout(() => {
        loginView.className += ' hidden';
      }, 250);
      setTimeout(() => {
        changePasswordView.classList.remove('hidden');
      }, 251);
      setTimeout(() => {
        changePasswordView.classList.remove('remove');
      }, 301);

      setTimeout(() => {
        document.getElementById('newPassword').focus();
      }, 400);
    };

    $scope.changePassword = () => {
      $scope.command.oldPassword = 'admin';

      if ($scope.command.newPassword !== $scope.command.confirmNew) {
        $scope.appEvent('alert-warning', ['New passwords do not match', '']);
        return;
      }

      backendSrv.put('/api/user/password', $scope.command).then(() => {
        $scope.toGrafana();
      });
    };

    $scope.skip = () => {
      $scope.toGrafana();
    };

    $scope.loginModeChanged = (newValue: boolean) => {
      $scope.submitBtnText = newValue ? 'Log in' : 'Sign up';
    };

    $scope.signUp = () => {
      if (!$scope.loginForm.$valid) {
        return;
      }

      backendSrv.post('/api/user/signup', $scope.formModel).then((result: any) => {
        if (result.status === 'SignUpCreated') {
          $location.path('/signup').search({ email: $scope.formModel.email });
        } else {
          window.location.href = config.appSubUrl + '/';
        }
      });
    };

    $scope.login = () => {
      delete $scope.loginError;

      if (!$scope.loginForm.$valid) {
        return;
      }
      $scope.loggingIn = true;

      backendSrv
        .post('/login', $scope.formModel)
        .then((result: any) => {
          $scope.result = result;

          if ($scope.formModel.password !== 'admin' || $scope.ldapEnabled || $scope.authProxyEnabled) {
            $scope.toGrafana();
            return;
          } else {
            $scope.changeView();
          }
        })
        .catch(() => {
          $scope.loggingIn = false;
        });
    };

    $scope.toGrafana = () => {
      const params = $location.search();

      if (params.redirect && params.redirect[0] === '/') {
        window.location.href = config.appSubUrl + params.redirect;
      } else if ($scope.result.redirectUrl) {
        window.location.href = $scope.result.redirectUrl;
      } else {
        window.location.href = config.appSubUrl + '/';
      }
    };

    $scope.init();
  }
}

coreModule.controller('LoginCtrl', LoginCtrl);
