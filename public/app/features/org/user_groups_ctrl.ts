///<reference path="../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import {appEvents} from 'app/core/core';

export class UserGroupsCtrl {
  userGroups: any;
  pages = [];
  perPage = 50;
  page = 1;
  totalPages: number;
  showPaging = false;
  query: any = '';
  navModel: any;

  /** @ngInject */
  constructor(private $scope, private $http, private backendSrv, private $location, navModelSrv) {
    this.navModel = navModelSrv.getOrgNav(3);
    this.get();
  }

  get() {
    this.backendSrv.get(`/api/user-groups/search?perpage=${this.perPage}&page=${this.page}&query=${this.query}`)
      .then((result) => {
        this.userGroups = result.userGroups;
        this.page = result.page;
        this.perPage = result.perPage;
        this.totalPages = Math.ceil(result.totalCount / result.perPage);
        this.showPaging = this.totalPages > 1;
        this.pages = [];

        for (var i = 1; i < this.totalPages+1; i++) {
          this.pages.push({ page: i, current: i === this.page});
        }
      });
  }

  navigateToPage(page) {
    this.page = page.page;
    this.get();
  }

  deleteUserGroup(userGroup) {
    this.$scope.appEvent('confirm-modal', {
      title: 'Delete',
      text: 'Are you sure you want to delete User Group ' + userGroup.name + '?',
      yesText: "Delete",
      icon: "fa-warning",
      onConfirm: () => {
        this.deleteUserGroupConfirmed(userGroup);
      }
    });
  }

  deleteUserGroupConfirmed(userGroup) {
    this.backendSrv.delete('/api/user-groups/' + userGroup.id)
      .then(this.get.bind(this));
  }

  openUserGroupModal() {
    appEvents.emit('show-modal', {
      templateHtml: '<create-user-group-modal></create-user-group-modal>',
      modalClass: 'modal--narrow'
    });
  }
}

coreModule.controller('UserGroupsCtrl', UserGroupsCtrl);
