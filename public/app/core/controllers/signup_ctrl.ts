import config from 'app/core/config';
import coreModule from '../core_module';

export class SignUpCtrl {
  /** @ngInject */
  constructor(private $scope: any, private backendSrv: any, $location: any, contextSrv: any) {
    contextSrv.sidemenu = false;
    $scope.ctrl = this;

    $scope.formModel = {};

    const params = $location.search();

    // validate email is semi ok
    if (params.email && !params.email.match(/^\S+@\S+$/)) {
      console.log('invalid email');
      return;
    }

    $scope.formModel.orgName = params.email;
    $scope.formModel.email = params.email;
    $scope.formModel.username = params.email;
    $scope.formModel.code = params.code;

    $scope.verifyEmailEnabled = false;
    $scope.autoAssignOrg = false;

    $scope.navModel = {
      main: {
        icon: 'gicon gicon-branding',
        text: 'Sign Up',
        subTitle: 'Register your Grafana account',
        breadcrumbs: [{ title: 'Login', url: 'login' }],
      },
    };

    backendSrv.get('/api/user/signup/options').then(options => {
      $scope.verifyEmailEnabled = options.verifyEmailEnabled;
      $scope.autoAssignOrg = options.autoAssignOrg;
    });
  }

  submit() {
    if (!this.$scope.signUpForm.$valid) {
      return;
    }

    this.backendSrv.post('/api/user/signup/step2', this.$scope.formModel).then(rsp => {
      if (rsp.code === 'redirect-to-select-org') {
        window.location.href = config.appSubUrl + '/profile/select-org?signup=1';
      } else {
        window.location.href = config.appSubUrl + '/';
      }
    });
  }
}

coreModule.controller('SignUpCtrl', SignUpCtrl);
