import coreModule from 'app/core/core_module';
import { backendSrv } from 'app/core/services/backend_srv';
import { NavModelSrv } from 'app/core/core';
import { ILocationService } from 'angular';

export class UserInviteCtrl {
  navModel: any;
  invite: any;
  inviteForm: any;

  /** @ngInject */
  constructor(navModelSrv: NavModelSrv, private $location: ILocationService) {
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

    backendSrv.post('/api/org/invites', this.invite).then(() => {
      this.$location.path('org/users/');
    });
  }
}

coreModule.controller('UserInviteCtrl', UserInviteCtrl);
