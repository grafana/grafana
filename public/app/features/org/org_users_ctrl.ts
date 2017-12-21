import config from 'app/core/config';
import coreModule from 'app/core/core_module';
import Remarkable from 'remarkable';
import _ from 'lodash';

export class OrgUsersCtrl {
  unfiltered: any;
  users: any;
  pendingInvites: any;
  editor: any;
  navModel: any;
  externalUserMngLinkUrl: string;
  externalUserMngLinkName: string;
  externalUserMngInfo: string;
  canInvite: boolean;
  searchQuery: string;
  showInvites: boolean;

  /** @ngInject */
  constructor(private $scope, private backendSrv, navModelSrv, $sce) {
    this.navModel = navModelSrv.getNav('cfg', 'users', 0);

    this.get();
    this.externalUserMngLinkUrl = config.externalUserMngLinkUrl;
    this.externalUserMngLinkName = config.externalUserMngLinkName;
    this.canInvite = !config.disableLoginForm && !config.externalUserMngLinkName;

    // render external user management info markdown
    if (config.externalUserMngInfo) {
      this.externalUserMngInfo = new Remarkable({
        linkTarget: '__blank',
      }).render(config.externalUserMngInfo);
    }
  }

  get() {
    this.backendSrv.get('/api/org/users').then(users => {
      this.users = users;
      this.unfiltered = users;
    });
    this.backendSrv.get('/api/org/invites').then(pendingInvites => {
      this.pendingInvites = pendingInvites;
    });
  }

  onQueryUpdated() {
    let regex = new RegExp(this.searchQuery, 'ig');
    this.users = _.filter(this.unfiltered, item => {
      return regex.test(item.email) || regex.test(item.login);
    });
  }

  updateOrgUser(user) {
    this.backendSrv.patch('/api/org/users/' + user.userId, user);
  }

  removeUser(user) {
    this.$scope.appEvent('confirm-modal', {
      title: 'Delete',
      text: 'Are you sure you want to delete user ' + user.login + '?',
      yesText: 'Delete',
      icon: 'fa-warning',
      onConfirm: () => {
        this.removeUserConfirmed(user);
      },
    });
  }

  removeUserConfirmed(user) {
    this.backendSrv.delete('/api/org/users/' + user.userId).then(this.get.bind(this));
  }

  revokeInvite(invite, evt) {
    evt.stopPropagation();
    this.backendSrv.patch('/api/org/invites/' + invite.code + '/revoke').then(this.get.bind(this));
  }

  copyInviteToClipboard(evt) {
    evt.stopPropagation();
  }

  getInviteUrl(invite) {
    return invite.url;
  }
}

coreModule.controller('OrgUsersCtrl', OrgUsersCtrl);
