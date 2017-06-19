///<reference path="../../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import _ from 'lodash';

export class AclCtrl {
  tabIndex: any;
  dashboard: any;
  userPermissions: Permission[];
  userGroupPermissions: Permission[];
  permissionTypeOptions = [
    {value: 1, text: 'View'},
    {value: 2, text: 'Read-only Edit'},
    {value: 4, text: 'Edit'}
  ];

  roleOptions = [
    {value: 0, text: 'None'},
    {value: 1, text: 'View'},
    {value: 2, text: 'Read-only Edit'},
    {value: 4, text: 'Edit'}
  ];

  roles = [];

  type = 'User Group';
  permission = 1;
  userId: number;
  userGroupId: number;

  /** @ngInject */
  constructor(private backendSrv, private $scope) {
    this.tabIndex = 0;
    this.userPermissions = [];
    this.userGroupPermissions = [];
    this.get(this.dashboard.id);
  }

  get(dashboardId: number) {
    return this.backendSrv.get(`/api/dashboards/id/${dashboardId}/acl`)
      .then(result => {
        this.userPermissions = _.filter(result, p => { return p.userId > 0;});
        this.userGroupPermissions = _.filter(result, p => { return p.userGroupId > 0;});
        this.roles = this.setRoles(result);
      });
  }

  setRoles(result: any) {
    return [
      {name: 'Org Viewer', permissions: 1},
      {name: 'Org Read Only Editor', permissions: 2},
      {name: 'Org Editor', permissions: 4},
      {name: 'Org Admin', permissions: 4}
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

  addOrUpdateUserPermission(userId: number, permissionType: number) {
    return this.backendSrv.post(`/api/dashboards/id/${this.dashboard.id}/acl`, {
      userId: userId,
      permissions: permissionType
    });
  }

  addOrUpdateUserGroupPermission(userGroupId: number, permissionType: number) {
    return this.backendSrv.post(`/api/dashboards/id/${this.dashboard.id}/acl`, {
      userGroupId: userGroupId,
      permissions: permissionType
    });
  }

  updatePermission(permission: any) {
    if (permission.userId > 0) {
      return this.addOrUpdateUserPermission(permission.userId, permission.permissions);
    } else {
      if (!permission.userGroupId) {
        return;
      }
      return this.addOrUpdateUserGroupPermission(permission.userGroupId, permission.permissions);
    }
  }

  removePermission(permission: Permission) {
    return this.backendSrv.delete(`/api/dashboards/id/${permission.dashboardId}/acl/${permission.id}`).then(() => {
      return this.get(permission.dashboardId);
    });
  }
}

export function aclSettings() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/acl/acl.html',
    controller: AclCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: { dashboard: "=" }
  };
}

export interface FormModel {
  dashboardId: number;
  userId?: number;
  userGroupId?: number;
  PermissionType: number;
}

export interface Permission {
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
  permissions: string[];
  permissionType: number[];
}

coreModule.directive('aclSettings', aclSettings);
