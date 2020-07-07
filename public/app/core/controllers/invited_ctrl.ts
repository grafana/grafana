import coreModule from '../core_module';
import config from 'app/core/config';
import { getBackendSrv } from '@grafana/runtime';
import { promiseToDigest } from '../utils/promiseToDigest';

export class InvitedCtrl {
  /** @ngInject */
  constructor($scope: any, $routeParams: any, contextSrv: any) {
    contextSrv.sidemenu = false;
    $scope.formModel = {};

    $scope.navModel = {
      main: {
        icon: 'grafana',
        text: 'Invite',
        subTitle: 'Register your Grafana account',
        breadcrumbs: [{ title: 'Login', url: 'login' }],
      },
    };

    $scope.init = () => {
      promiseToDigest($scope)(
        getBackendSrv()
          .get('/api/user/invite/' + $routeParams.code)
          .then((invite: any) => {
            $scope.formModel.name = invite.name;
            $scope.formModel.email = invite.email;
            $scope.formModel.username = invite.email;
            $scope.formModel.inviteCode = $routeParams.code;

            $scope.greeting = invite.name || invite.email || invite.username;
            $scope.invitedBy = invite.invitedBy;
          })
      );
    };

    $scope.submit = () => {
      if (!$scope.inviteForm.$valid) {
        return;
      }

      getBackendSrv()
        .post('/api/user/invite/complete', $scope.formModel)
        .then(() => {
          window.location.href = config.appSubUrl + '/';
        });
    };

    $scope.init();
  }
}

coreModule.controller('InvitedCtrl', InvitedCtrl);
