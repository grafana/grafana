///<reference path="../../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import _ from 'lodash';

export class AclCtrl {
  dashboard: any;
  userAcl: DashboardAcl[];
  groupAcl: DashboardAcl[];
  permissionTypeOptions = [
    {value: 1, text: 'View'},
    {value: 2, text: 'Edit'},
    {value: 4, text: 'Admin'}
  ];

  roleOptions = [
    {value: 0, text: 'No Access'},
    {value: 1, text: 'View'},
    {value: 2, text: 'Edit'},
    {value: 4, text: 'Admin'}
  ];

  roles = [];

  type = 'User Group';
  permission = 1;
  userId: number;
  userGroupId: number;

  /** @ngInject */
  constructor(private backendSrv, private dashboardSrv) {
    this.userAcl = [];
    this.groupAcl = [];
    this.dashboard = dashboardSrv.getCurrent();
    this.get(this.dashboard.id);
  }

  get(dashboardId: number) {
    return this.backendSrv.get(`/api/dashboards/id/${dashboardId}/acl`)
      .then(result => {
        this.userAcl = _.filter(result, p => { return p.userId > 0;});
        this.groupAcl = _.filter(result, p => { return p.userGroupId > 0;});
        this.roles = this.setRoles(result);
      });
  }

  setRoles(result: any) {
    return [
      {name: 'Viewer', permissions: 1},
      {name: 'Editor', permissions: 2},
      {name: 'Admin', permissions: 4}
    ];
  }

  addPermission() {
    if (this.type === 'User') {
      if (!this.userId) {
        return;
      }
      return this.addOrUpdateUserPermission(this.userId, this.permission).then(() => {
        this.userId = null;
        return this.get(this.dashboard.id);
      });
    } else {
      if (!this.userGroupId) {
        return;
      }

      return this.addOrUpdateUserGroupPermission(this.userGroupId, this.permission).then(() => {
        this.userGroupId = null;
        return this.get(this.dashboard.id);
      });
    }
  }

  addOrUpdateUserPermission(userId: number, permissions: number) {
    return this.backendSrv.post(`/api/dashboards/id/${this.dashboard.id}/acl`, {
      userId: userId,
      permissions: permissions
    });
  }

  addOrUpdateUserGroupPermission(userGroupId: number, permissions: number) {
    return this.backendSrv.post(`/api/dashboards/id/${this.dashboard.id}/acl`, {
      userGroupId: userGroupId,
      permissions: permissions
    });
  }

  updatePermission(permission: DashboardAcl) {
    if (permission.userId > 0) {
      return this.addOrUpdateUserPermission(permission.userId, permission.permissions);
    } else {
      if (!permission.userGroupId) {
        return;
      }
      return this.addOrUpdateUserGroupPermission(permission.userGroupId, permission.permissions);
    }
  }

  removePermission(permission: DashboardAcl) {
    return this.backendSrv.delete(`/api/dashboards/id/${permission.dashboardId}/acl/${permission.id}`).then(() => {
      return this.get(permission.dashboardId);
    });
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
  id: number;
  orgId: number;
  dashboardId: number;
  created: Date;
  updated: Date;
  userId: number;
  userLogin: number;
  userEmail: string;
  userGroupId: number;
  userGroup: string;
  permissions: number;
  permissionName: string;
}

coreModule.directive('dashAclModal', dashAclModal);
