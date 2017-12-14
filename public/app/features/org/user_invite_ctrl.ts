import coreModule from 'app/core/core_module';

export class UserInviteCtrl {
  navModel: any;
  invite: any;
  inviteForm: any;

  /** @ngInject **/
  constructor(private backendSrv, navModelSrv, private $location) {
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

    return this.backendSrv.post('/api/org/invites', this.invite).then(() => {
      this.$location.path('org/users/');
    });
  }
}

coreModule.controller('UserInviteCtrl', UserInviteCtrl);
