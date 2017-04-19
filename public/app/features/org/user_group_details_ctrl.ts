///<reference path="../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import _ from 'lodash';

export default class UserGroupDetailsCtrl {
  userGroup: any;
  userGroupMembers = [];
  user: any;
  usersSearchCache = [];
  searchUsers: any;

  constructor(private $scope, private $http, private backendSrv, private $routeParams) {
    this.get();
    this.usersSearchCache = [];
    this.searchUsers = (queryStr, callback) => {
      if (this.usersSearchCache.length > 0) {
        callback(_.map(this.usersSearchCache, (user) => { return user.login + ' - ' + user.email; }));
        return;
      }

      this.backendSrv.get('/api/users/search?perpage=10&page=1&query=' + queryStr).then(result => {
        this.usersSearchCache = result.users;
        callback(_.map(result.users, (user) => { return user.login + ' - ' + user.email; }));
      });
    };
  }

  get() {
    if (this.$routeParams && this.$routeParams.id) {
      this.backendSrv.get(`/api/user-groups/${this.$routeParams.id}`)
        .then(result => {
          this.userGroup = result;
        });
      this.backendSrv.get(`/api/user-groups/${this.$routeParams.id}/members`)
        .then(result => {
          this.userGroupMembers = result;
        });
    }
  }

  removeUserGroupMember(userGroupMember) {
    this.$scope.appEvent('confirm-modal', {
      title: 'Remove Member',
      text: 'Are you sure you want to remove ' + userGroupMember.name + ' from this group?',
      yesText: "Remove",
      icon: "fa-warning",
      onConfirm: () => {
        this.removeMemberConfirmed(userGroupMember);
      }
    });
  }

  removeMemberConfirmed(userGroupMember) {
    this.backendSrv.delete(`/api/user-groups/${this.$routeParams.id}/members/${userGroupMember.userId}`)
      .then(this.get.bind(this));
  }

  update() {
    if (!this.$scope.userGroupDetailsForm.$valid) { return; }

    this.backendSrv.put('/api/user-groups/' + this.userGroup.id, {name: this.userGroup.name});
  }

  addMember() {
    if (!this.$scope.addMemberForm.$valid) { return; }

    const login = this.user.name.split(' - ')[0];
    const memberToAdd = _.find(this.usersSearchCache, ['login', login]);
    this.backendSrv.post(`/api/user-groups/${this.$routeParams.id}/members`, {userId: memberToAdd.id}).then(() => {
      this.user.name = '';
      this.get();
    });
  }
}

coreModule.controller('UserGroupDetailsCtrl', UserGroupDetailsCtrl);

