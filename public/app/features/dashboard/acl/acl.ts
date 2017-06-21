///<reference path="../../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import _ from 'lodash';

export class AclCtrl {
  dashboard: any;
  aclItems: DashboardAcl[];
  permissionOptions = [
    {value: 1, text: 'View'},
    {value: 2, text: 'Edit'},
    {value: 4, text: 'Admin'}
  ];

  newType: string;
  newAcl: DashboardAcl;
  canUpdate: boolean;

  /** @ngInject */
  constructor(private backendSrv, private dashboardSrv, private $sce, private $scope) {
    this.aclItems = [];
    this.newType = 'User Group';
    this.resetNew();

    this.dashboard = dashboardSrv.getCurrent();
    this.get(this.dashboard.id);
  }

  get(dashboardId: number) {
    return this.backendSrv.get(`/api/dashboards/id/${dashboardId}/acl`)
      .then(result => {
        this.aclItems = _.map(result, this.prepareViewModel.bind(this));
      });
  }

  prepareViewModel(item: DashboardAcl): DashboardAcl {
    if (item.userId > 0) {
      item.icon = "fa fa-fw fa-user";
      item.nameHtml = this.$sce.trustAsHtml(item.userLogin);
    } else if (item.userGroupId > 0) {
      item.icon = "fa fa-fw fa-users";
      item.nameHtml = this.$sce.trustAsHtml(item.userGroup);
    } else if (item.role) {
      item.icon = "fa fa-fw fa-street-view";
      item.nameHtml = this.$sce.trustAsHtml(`Everyone with <span class="query-keyword">${item.role}</span> Role`);
    }

    return item;
  }

  addPermission() {
    this.aclItems.push(this.prepareViewModel(this.newAcl));
    this.$scope.$broadcast('user-picker-reset');
    this.$scope.$broadcast('user-group-picker-reset');
  }

  resetNew() {
    this.newAcl = {
      userId: 0,
      userGroupId: 0,
      permission: 1
    };
  }

  update() {
    return this.backendSrv.post(`/api/dashboards/id/${this.dashboard.id}/acl`, {
      acl: this.aclItems
    });
  }

  permissionChanged() {
    this.canUpdate = true;
  }

  userPicked(user) {
    this.newAcl.userLogin = user.login;
    this.newAcl.userId = user.id;
  }

  removeItem(index) {
    this.aclItems.splice(index, 1);
    this.canUpdate = true;
  }
}

export function dashAclModal() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/acl/acl.html',
    controller: AclCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dismiss: "&"
    }
  };
}

export interface FormModel {
  dashboardId: number;
  userId?: number;
  userGroupId?: number;
  PermissionType: number;
}

export interface DashboardAcl {
  id?: number;
  dashboardId?: number;
  userId: number;
  userLogin?: number;
  userEmail?: string;
  userGroupId: number;
  userGroup?: string;
  permission?: number;
  permissionName?: string;
  role?: string;
  icon?: string;
  nameHtml?: string;
}

coreModule.directive('dashAclModal', dashAclModal);
