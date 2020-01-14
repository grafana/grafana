import coreModule from 'app/core/core_module';
import { getBackendSrv } from '@grafana/runtime';
import { NavModelSrv } from 'app/core/core';
import { ILocationService } from 'angular';
import { promiseToDigest } from 'app/core/utils/promiseToDigest';

export class UserInviteCtrl {
  navModel: any;
  invite: any;
  inviteForm: any;
  digest: (promise: Promise<any>) => Promise<any>;

  /** @ngInject */
  constructor($scope: any, navModelSrv: NavModelSrv, private $location: ILocationService) {
    this.navModel = navModelSrv.getNav('cfg', 'users', 0);
    this.digest = promiseToDigest($scope);

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

    this.digest(
      getBackendSrv()
        .post('/api/org/invites', this.invite)
        .then(() => {
          this.$location.path('org/users/');
        })
    );
  }
}

coreModule.controller('UserInviteCtrl', UserInviteCtrl);
