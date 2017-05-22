///<reference path="../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';

export default class UserGroupsCtrl {
  userGroups: any;
  pages = [];
  perPage = 50;
  page = 1;
  totalPages: number;
  showPaging = false;
  query: any = '';
  userGroupName: any = '';

  /** @ngInject */
  constructor(private $scope, private $http, private backendSrv, private $location) {
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

  createUserGroup() {
    this.backendSrv.post('/api/user-groups', {name: this.userGroupName}).then((result) => {
      if (result.userGroupId) {
        this.$location.path('/org/user-groups/edit/' + result.userGroupId);
      }
    });
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
    var modalScope = this.$scope.$new();
    modalScope.createUserGroup = this.createUserGroup.bind(this);

    this.$scope.appEvent('show-modal', {
      src: 'public/app/features/org/partials/create_user_group.html',
      modalClass: 'user-group-modal',
      scope: modalScope
    });
  }
}

coreModule.controller('UserGroupsCtrl', UserGroupsCtrl);
