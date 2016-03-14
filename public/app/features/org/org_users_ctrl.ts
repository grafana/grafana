///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from '../../core/core_module';

export class OrgUsersCtrl {

  user: any;
  users: any;
  pendingInvites: any;
  editor: any;

  /** @ngInject */
  constructor(private $scope, private $http, private backendSrv) {
    this.user = {
      loginOrEmail: '',
      role: 'Viewer',
    };
    this.get();
    this.editor = { index: 0 };
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
      .then(() => {
        this.get();
      });
  }

  revokeInvite(invite, evt) {
    evt.stopPropagation();
    this.backendSrv.patch('/api/org/invites/' + invite.code + '/revoke')
      .then(() => {
        this.get();
      });
  }

  copyInviteToClipboard(evt) {
    evt.stopPropagation();
  }

  openInviteModal() {
    var modalScope = this.$scope.$new();
    modalScope.invitesSent = function() {
      this.get();
    };

    this.$scope.appEvent('show-modal', {
      src: 'public/app/features/org/partials/invite.html',
      modalClass: 'invite-modal',
      scope: modalScope
    });
  }

}

coreModule.controller('OrgUsersCtrl', OrgUsersCtrl);
