///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import coreModule from 'app/core/core_module';
import Remarkable from 'remarkable';

export class OrgUsersCtrl {

  user: any;
  users: any;
  pendingInvites: any;
  editor: any;
  navModel: any;
  externalUserMngLinkUrl: string;
  externalUserMngLinkName: string;
  externalUserMngInfo: string;
  addUsersBtnName: string;

  /** @ngInject */
  constructor(private $scope, private $http, private backendSrv, navModelSrv, $sce) {
    this.user = {
      loginOrEmail: '',
      role: 'Viewer',
    };
    this.navModel = navModelSrv.getOrgNav(0);

    this.get();
    this.editor = { index: 0 };
    this.externalUserMngLinkUrl = config.externalUserMngLinkUrl;
    this.externalUserMngLinkName = config.externalUserMngLinkName;

    // render external user management info markdown
    if (config.externalUserMngInfo) {
      this.externalUserMngInfo = new Remarkable({
        linkTarget: '__blank',
      }).render(config.externalUserMngInfo);
    }

    this.addUsersBtnName = this.getAddUserBtnName();
  }

  getAddUserBtnName(): string {
    if (this.externalUserMngLinkName) {
      return this.externalUserMngLinkName;
    } else if (config.disableLoginForm) {
      return "Add Users";
    } else {
      return "Add or Invite";
    }
  }

  get() {
    this.backendSrv.get('/api/org/users')
      .then((users) => {
        this.users = users;
      });
    this.backendSrv.get('/api/org/invites')
      .then((pendingInvites) => {
        this.pendingInvites = pendingInvites;
      });
  }

  updateOrgUser(user) {
    this.backendSrv.patch('/api/org/users/' + user.userId, user);
  }

  removeUser(user) {
    this.$scope.appEvent('confirm-modal', {
      title: 'Delete',
      text: 'Are you sure you want to delete user ' + user.login + '?',
      yesText: "Delete",
      icon: "fa-warning",
      onConfirm: () => {
        this.removeUserConfirmed(user);
      }
    });
  }

  removeUserConfirmed(user) {
    this.backendSrv.delete('/api/org/users/' + user.userId)
      .then(this.get.bind(this));
  }

  revokeInvite(invite, evt) {
    evt.stopPropagation();
    this.backendSrv.patch('/api/org/invites/' + invite.code + '/revoke')
      .then(this.get.bind(this));
  }

  copyInviteToClipboard(evt) {
    evt.stopPropagation();
  }

 getInviteUrl(invite) {
   return invite.url;
 }

 openAddUsersView() {
   var modalScope = this.$scope.$new();
   modalScope.invitesSent = this.get.bind(this);

   var src = config.disableLoginForm
     ? 'public/app/features/org/partials/add_user.html'
     : 'public/app/features/org/partials/invite.html';

     this.$scope.appEvent('show-modal', {
       src: src,
       modalClass: 'invite-modal',
       scope: modalScope
     });
 }

}

coreModule.controller('OrgUsersCtrl', OrgUsersCtrl);
