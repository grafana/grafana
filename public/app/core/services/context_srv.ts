import config from '../../core/config';
import _ from 'lodash';
import coreModule from 'app/core/core_module';
import { rangeUtil } from '@grafana/data';
import { AccessControlAction, AccessControlScope } from 'app/types';

export class User {
  id: number;
  isGrafanaAdmin: any;
  isSignedIn: any;
  orgRole: any;
  orgId: number;
  orgName: string;
  login: string;
  orgCount: number;
  timezone: string;
  helpFlags1: number;
  lightTheme: boolean;
  hasEditPermissionInFolders: boolean;
  email?: string;
  permissions?: UserPermission;

  constructor() {
    if (config.bootData.user) {
      _.extend(this, config.bootData.user);
    }
  }
}

/**
 * UserPermission is a map storing permissions in a form of
 * {
 *   action: { scope: scope }
 * }
 */
export type UserPermission = {
  [key: string]: { [key: string]: string };
};

export class ContextSrv {
  pinned: any;
  version: any;
  user: User;
  isSignedIn: any;
  isGrafanaAdmin: any;
  isEditor: any;
  sidemenuSmallBreakpoint = false;
  hasEditPermissionInFolders: boolean;
  minRefreshInterval: string;

  constructor() {
    if (!config.bootData) {
      config.bootData = { user: {}, settings: {} };
    }

    this.user = new User();
    this.isSignedIn = this.user.isSignedIn;
    this.isGrafanaAdmin = this.user.isGrafanaAdmin;
    this.isEditor = this.hasRole('Editor') || this.hasRole('Admin');
    this.hasEditPermissionInFolders = this.user.hasEditPermissionInFolders;
    this.minRefreshInterval = config.minRefreshInterval;
  }

  /**
   * Indicate the user has been logged out
   */
  setLoggedOut() {
    this.user.isSignedIn = false;
    this.isSignedIn = false;
  }

  hasRole(role: string) {
    return this.user.orgRole === role;
  }

  // Checks whether user has required permission
  hasPermission(action: AccessControlAction, scope?: AccessControlScope): boolean {
    return !!(
      this.user.permissions &&
      this.user.permissions[action] &&
      (scope ? this.user.permissions[action][scope] : true)
    );
  }

  isGrafanaVisible() {
    return !!(document.visibilityState === undefined || document.visibilityState === 'visible');
  }

  // checks whether the passed interval is longer than the configured minimum refresh rate
  isAllowedInterval(interval: string) {
    if (!config.minRefreshInterval) {
      return true;
    }
    return rangeUtil.intervalToMs(interval) >= rangeUtil.intervalToMs(config.minRefreshInterval);
  }

  getValidInterval(interval: string) {
    if (!this.isAllowedInterval(interval)) {
      return config.minRefreshInterval;
    }
    return interval;
  }

  hasAccessToExplore() {
    return (this.isEditor || config.viewersCanEdit) && config.exploreEnabled;
  }
}

const contextSrv = new ContextSrv();
export { contextSrv };

coreModule.factory('contextSrv', () => {
  return contextSrv;
});
