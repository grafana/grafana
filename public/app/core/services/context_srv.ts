import { extend } from 'lodash';

import { AnalyticsSettings, OrgRole, rangeUtil, WithAccessControlMetadata } from '@grafana/data';
import { featureEnabled, getBackendSrv } from '@grafana/runtime';
import { AccessControlAction, UserPermission } from 'app/types';
import { CurrentUserInternal } from 'app/types/config';

import config from '../../core/config';

export class User implements Omit<CurrentUserInternal, 'lightTheme'> {
  isSignedIn: boolean;
  id: number;
  login: string;
  email: string;
  name: string;
  externalUserId: string;
  theme: string;
  orgCount: number;
  orgId: number;
  orgName: string;
  orgRole: OrgRole | '';
  isGrafanaAdmin: boolean;
  gravatarUrl: string;
  timezone: string;
  weekStart: string;
  locale: string;
  language: string;
  helpFlags1: number;
  hasEditPermissionInFolders: boolean;
  permissions?: UserPermission;
  analytics: AnalyticsSettings;
  fiscalYearStartMonth: number;

  constructor() {
    this.id = 0;
    this.isGrafanaAdmin = false;
    this.isSignedIn = false;
    this.orgRole = '';
    this.orgId = 0;
    this.orgName = '';
    this.login = '';
    this.externalUserId = '';
    this.orgCount = 0;
    this.timezone = '';
    this.fiscalYearStartMonth = 0;
    this.helpFlags1 = 0;
    this.theme = 'dark';
    this.hasEditPermissionInFolders = false;
    this.email = '';
    this.name = '';
    this.locale = '';
    this.language = '';
    this.weekStart = '';
    this.gravatarUrl = '';
    this.analytics = {
      identifier: '',
    };

    if (config.bootData.user) {
      extend(this, config.bootData.user);
    }
  }
}

export class ContextSrv {
  pinned: any;
  version: any;
  user: User;
  isSignedIn: boolean;
  isGrafanaAdmin: boolean;
  isEditor: boolean;
  sidemenuSmallBreakpoint = false;
  hasEditPermissionInFolders: boolean;
  minRefreshInterval: string;

  constructor() {
    if (!config.bootData) {
      config.bootData = { user: {}, settings: {}, navTree: [] } as any;
    }

    this.user = new User();
    this.isSignedIn = this.user.isSignedIn;
    this.isGrafanaAdmin = this.user.isGrafanaAdmin;
    this.isEditor = this.hasRole('Editor') || this.hasRole('Admin');
    this.hasEditPermissionInFolders = this.user.hasEditPermissionInFolders;
    this.minRefreshInterval = config.minRefreshInterval;
  }

  async fetchUserPermissions() {
    try {
      if (this.accessControlEnabled()) {
        this.user.permissions = await getBackendSrv().get('/api/access-control/user/actions', {
          reloadcache: true,
        });
      }
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Indicate the user has been logged out
   */
  setLoggedOut() {
    this.user.isSignedIn = false;
    this.isSignedIn = false;
  }

  hasRole(role: string) {
    if (role === 'ServerAdmin') {
      return this.isGrafanaAdmin;
    } else {
      return this.user.orgRole === role;
    }
  }

  accessControlEnabled(): boolean {
    return config.rbacEnabled;
  }

  licensedAccessControlEnabled(): boolean {
    return featureEnabled('accesscontrol') && config.rbacEnabled;
  }

  // Checks whether user has required permission
  hasPermissionInMetadata(action: AccessControlAction | string, object: WithAccessControlMetadata): boolean {
    // Fallback if access control disabled
    if (!this.accessControlEnabled()) {
      return true;
    }

    return !!object.accessControl?.[action];
  }

  // Checks whether user has required permission
  hasPermission(action: AccessControlAction | string): boolean {
    // Fallback if access control disabled
    if (!this.accessControlEnabled()) {
      return true;
    }

    return !!this.user.permissions?.[action];
  }

  isGrafanaVisible() {
    return document.visibilityState === undefined || document.visibilityState === 'visible';
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
    if (this.accessControlEnabled()) {
      return this.hasPermission(AccessControlAction.DataSourcesExplore) && config.exploreEnabled;
    }
    return (this.isEditor || config.viewersCanEdit) && config.exploreEnabled;
  }

  hasAccess(action: string, fallBack: boolean): boolean {
    if (!this.accessControlEnabled()) {
      return fallBack;
    }
    return this.hasPermission(action);
  }

  hasAccessInMetadata(action: string, object: WithAccessControlMetadata, fallBack: boolean): boolean {
    if (!this.accessControlEnabled()) {
      return fallBack;
    }
    return this.hasPermissionInMetadata(action, object);
  }

  // evaluates access control permissions, granting access if the user has any of them; uses fallback if access control is disabled
  evaluatePermission(fallback: () => string[], actions: string[]) {
    if (!this.accessControlEnabled()) {
      return fallback();
    }
    if (actions.some((action) => this.hasPermission(action))) {
      return [];
    }
    // Hack to reject when user does not have permission
    return ['Reject'];
  }
}

let contextSrv = new ContextSrv();
export { contextSrv };

export const setContextSrv = (override: ContextSrv) => {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('contextSrv can be only overridden in test environment');
  }
  contextSrv = override;
};
