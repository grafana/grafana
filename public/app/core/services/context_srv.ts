import { extend } from 'lodash';

import {
  type AnalyticsSettings,
  type OrgRole,
  rangeUtil,
  type WithAccessControlMetadata,
  userHasPermission,
  userHasPermissionInMetadata,
  userHasAnyPermission,
} from '@grafana/data';
import { featureEnabled, getBackendSrv } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { type UserPermission, AccessControlAction } from 'app/types/accessControl';
import { type CurrentUserInternal } from 'app/types/config';

import config from '../../core/config';

import { loadUserPermissions } from './userPermissions';

// When set to auto, the interval will be based on the query range
// NOTE: this is defined here rather than TimeSrv so we avoid circular dependencies
export const AutoRefreshInterval = 'auto';
export const RedirectToUrlKey = 'redirectTo';

export class User implements Omit<CurrentUserInternal, 'lightTheme'> {
  isSignedIn: boolean;
  id: number;
  uid: string;
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
  language: string;
  hasEditPermissionInFolders: boolean;
  permissions?: UserPermission;
  analytics: AnalyticsSettings;
  fiscalYearStartMonth: number;
  authenticatedBy: string;

  constructor() {
    this.id = 0;
    this.uid = '';
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
    this.theme = 'dark';
    this.hasEditPermissionInFolders = false;
    this.email = '';
    this.name = '';
    this.language = '';
    this.weekStart = '';
    this.gravatarUrl = '';
    this.analytics = {
      identifier: '',
    };
    this.authenticatedBy = '';

    if (config.bootData.user) {
      extend(this, config.bootData.user);
    }
  }
}

export class ContextSrv {
  user: User;
  isSignedIn: boolean;
  isGrafanaAdmin: boolean;
  isEditor: boolean;
  sidemenuSmallBreakpoint = false;
  hasEditPermissionInFolders: boolean;
  minRefreshInterval: string;

  private sessionHeartbeatJob?: ReturnType<typeof setTimeout>;

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

    this.scheduleSessionHeartbeat();
  }

  async fetchUserPermissions() {
    if (getFeatureFlagClient().getBooleanValue(FlagKeys.GrafanaMultiTenantUserPermissions, false)) {
      // Null means the request failed; keep the permissions we already have rather
      // than downgrading the session to "no permissions"
      const permissions = await loadUserPermissions();
      if (permissions) {
        this.user.permissions = permissions;
      }
      return;
    }

    try {
      this.user.permissions = await getBackendSrv().get('/api/access-control/user/actions', {
        reloadcache: true,
      });
    } catch (e) {
      console.error(e);
    }
  }

  /**
   * Indicate the user has been logged out
   */
  setLoggedOut() {
    this.setRedirectToUrl();
    clearTimeout(this.sessionHeartbeatJob);
    this.user.isSignedIn = false;
    this.isSignedIn = false;
    window.location.reload();
  }

  setRedirectToUrl() {
    if (config.featureToggles.useSessionStorageForRedirection) {
      window.sessionStorage.setItem(
        RedirectToUrlKey,
        encodeURIComponent(window.location.href.substring(window.location.origin.length))
      );
    }
  }

  hasRole(role: string) {
    if (role === 'ServerAdmin') {
      return this.isGrafanaAdmin;
    } else {
      return this.user.orgRole === role;
    }
  }

  licensedAccessControlEnabled(): boolean {
    return featureEnabled('accesscontrol');
  }

  // Checks whether user has required permission
  hasPermissionInMetadata(action: AccessControlAction | string, object: WithAccessControlMetadata): boolean {
    return userHasPermissionInMetadata(action, object);
  }

  // Checks whether user has required permission
  hasPermission(action: AccessControlAction | string): boolean {
    return userHasPermission(action, this.user);
  }

  isGrafanaVisible() {
    return document.visibilityState === undefined || document.visibilityState === 'visible';
  }

  // checks whether the passed interval is longer than the configured minimum refresh rate
  isAllowedInterval(interval: string) {
    if (!config.minRefreshInterval || interval === AutoRefreshInterval) {
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

  getValidIntervals(intervals: string[]): string[] {
    if (this.minRefreshInterval) {
      return intervals.filter((str) => str !== '').filter(this.isAllowedInterval);
    }
    return intervals;
  }

  hasAccessToExplore() {
    return this.hasPermission(AccessControlAction.DataSourcesExplore) && config.exploreEnabled;
  }

  // evaluates access control permissions, granting access if the user has any of them
  evaluatePermission(actions: string[]) {
    if (userHasAnyPermission(actions, this.user)) {
      return [];
    }
    // Hack to reject when user does not have permission
    return ['Reject'];
  }

  private scheduleSessionHeartbeat() {
    const interval = config.sessionHeartbeatInterval;
    if (!this.isSignedIn || !interval || !Number.isFinite(interval) || interval <= 0) {
      return;
    }

    this.sessionHeartbeatJob = setTimeout(() => this.checkSession(), interval);
  }

  private async checkSession() {
    try {
      // Bypass the query queue so long-running dashboard requests cannot starve activity checks.
      const response = await fetch(config.appSubUrl + '/api/login/ping', { method: 'GET', cache: 'no-store' });
      if (response.status === 401) {
        this.setLoggedOut();
      }
    } catch (error) {
      console.error(error);
    } finally {
      // A network or server error is not evidence that the session has ended.
      this.scheduleSessionHeartbeat();
    }
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
