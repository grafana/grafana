import coreModule from 'app/core/core_module';
import { getBackendSrv } from '@grafana/runtime';
import { NavModelSrv } from 'app/core/core';
import { ILocationService, IScope } from 'angular';
import { promiseToDigest } from 'app/core/utils/promiseToDigest';

export class UserInviteCtrl {
  navModel: any;
  invite: any;
  inviteForm: any;

  /** @ngInject */
  constructor(private $scope: IScope, navModelSrv: NavModelSrv, private $location: ILocationService) {
    this.navModel = navModelSrv.getNav('cfg', 'users', 0);

    this.invite = {
      name: '',
      email: '',
      role: 'Editor',
      sendEmail: true,
    };
  }

  sendInvite() {
    if (!this.inviteForm.$valid) {
      return;
    }

    promiseToDigest(this.$scope)(
      getBackendSrv()
        .post('/api/org/invites', this.invite)
        .then(() => {
          this.$location.path('org/users/');
        })
    );
  }
}

coreModule.controller('UserInviteCtrl', UserInviteCtrl);
