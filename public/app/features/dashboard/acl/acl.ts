///<reference path="../../../headers/common.d.ts" />

import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';
import _ from 'lodash';

export class AclCtrl {
  tabIndex: any;
  dashboard: any;
  userPermissions: Permission[];
  userGroupPermissions: Permission[];

  /** @ngInject */
  constructor(private backendSrv, private $scope, $sce) {
    this.tabIndex = 0;
    this.userPermissions = [];
    this.userGroupPermissions = [];
    this.get(this.dashboard.id);
  }

  get(dashboardId: number) {
    return this.backendSrv.get(`/api/dashboards/${dashboardId}/acl`)
      .then(result => {
        this.userPermissions = _.filter(result, p => { return p.userId > 0;});
        this.userGroupPermissions = _.filter(result, p => { return p.userGroupId > 0;});
      });
  }

  removeUserPermission(permission: Permission) {
    this.backendSrv.delete(`/api/dashboards/${permission.dashboardId}/acl/user/${permission.userId}`).then(() => {
      this.get(permission.dashboardId);
    });
  }

  removeUserGroupPermission(permission: Permission) {
    this.backendSrv.delete(`/api/dashboards/${permission.dashboardId}/acl/user-group/${permission.userGroupId}`).then(() => {
      this.get(permission.dashboardId);
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
  permissions: number[];
}

coreModule.directive('aclSettings', aclSettings);
