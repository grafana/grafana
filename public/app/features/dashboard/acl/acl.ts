///<reference path="../../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import _ from 'lodash';

export class AclCtrl {
  dashboard: any;
  items: DashboardAcl[];
  permissionOptions = [
    {value: 1, text: 'View'},
    {value: 2, text: 'Edit'},
    {value: 4, text: 'Admin'}
  ];
  aclTypes = [
    {value: 'Group', text: 'User Group'},
    {value: 'User',  text: 'User'},
    {value: 'Viewer', text: 'Everyone With Viewer Role'},
    {value: 'Editor', text: 'Everyone With Editor Role'}
  ];

  dismiss: () => void;
  newType: string;
  canUpdate: boolean;

  /** @ngInject */
  constructor(private backendSrv, private dashboardSrv, private $sce, private $scope) {
    this.items = [];
    this.resetNewType();
    this.dashboard = dashboardSrv.getCurrent();
    this.get(this.dashboard.id);
  }

  resetNewType() {
    this.newType = 'Group';
  }

  get(dashboardId: number) {
    return this.backendSrv.get(`/api/dashboards/id/${dashboardId}/acl`)
      .then(result => {
        this.items = _.map(result, this.prepareViewModel.bind(this));
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

  update() {
    return this.backendSrv.post(`/api/dashboards/id/${this.dashboard.id}/acl`, {
      items: this.items.map(item => {
        return {
          id: item.id,
          userId: item.userId,
          userGroupId: item.userGroupId,
          role: item.role,
          permission: item.permission,
        };
      })
    }).then(() => {
      this.dismiss();
    });
  }

  typeChanged() {
    if (this.newType === 'Viewer' || this.newType === 'Editor') {
      this.items.push(this.prepareViewModel({
        permission: 1,
        role: this.newType
      }));

      this.canUpdate = true;
      this.resetNewType();
    }
  }

  permissionChanged() {
    this.canUpdate = true;
  }

  userPicked(user) {
    this.items.push(this.prepareViewModel({
      userId: user.id,
      userLogin: user.login,
      permission: 1,
    }));

    this.canUpdate = true;
    this.$scope.$broadcast('user-picker-reset');
  }

  groupPicked(group) {
    console.log(group);
    this.items.push(this.prepareViewModel({
      userGroupId: group.id,
      userGroup: group.name,
      permission: 1,
    }));

    this.canUpdate = true;
    this.$scope.$broadcast('user-group-picker-reset');
  }

  removeItem(index) {
    this.items.splice(index, 1);
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
  userId?: number;
  userLogin?: number;
  userEmail?: string;
  userGroupId?: number;
  userGroup?: string;
  permission?: number;
  permissionName?: string;
  role?: string;
  icon?: string;
  nameHtml?: string;
}

coreModule.directive('dashAclModal', dashAclModal);
