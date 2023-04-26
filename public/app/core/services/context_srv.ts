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

  private tokenRotationJobId = 0;

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

    if (this.isSignedIn) {
      this.scheduleTokenRotationJob();
    }
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
    this.cancelTokenRotationJob();
    this.user.isSignedIn = false;
    this.isSignedIn = false;
    window.location.reload();
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

  // schedules a job to perform token ration in the background
  private scheduleTokenRotationJob() {
    // only schedule job if feature toggle is enabled and user is signed in
    if (config.featureToggles.clientTokenRotation && this.isSignedIn) {
      // get the time token is going to expire
      let expires = this.getSessionExpiry();

      // if expires is 0 we run rotation now and reschedule the job
      // this can happen if user was signed in before upgrade
      // after a successful rotation the expiry cookie will be present
      if (expires === 0) {
        this.rotateToken().then();
        return;
      }

      // because this job is scheduled for every tab we have open that shares a session we try
      // to distribute the scheduling of the job. For now this can be between 1 and 20 seconds
      const expiresWithDistribution = expires - Math.floor(Math.random() * (20 - 1) + 1);

      // nextRun is when the job should be scheduled for
      let nextRun = expiresWithDistribution * 1000 - Date.now();

      // @ts-ignore
      this.tokenRotationJobId = setTimeout(() => {
        // if we have a new expiry time from the expiry cookie another tab have already performed the rotation
        // so the only thing we need to do is reschedule the job and exit
        if (this.getSessionExpiry() > expires) {
          this.scheduleTokenRotationJob();
          return;
        }
        this.rotateToken().then();
      }, nextRun);
    }
  }

  private cancelTokenRotationJob() {
    if (config.featureToggles.clientTokenRotation && this.tokenRotationJobId > 0) {
      clearTimeout(this.tokenRotationJobId);
    }
  }

  private rotateToken() {
    // We directly use fetch here to bypass the request queue from backendSvc
    return fetch('/api/user/auth-tokens/rotate', { method: 'POST' })
      .then((res) => {
        if (res.status === 200) {
          this.scheduleTokenRotationJob();
          return;
        }

        if (res.status === 401) {
          this.setLoggedOut();
          return;
        }
      })
      .catch((e) => {
        console.error(e);
      });
  }

  private getSessionExpiry() {
    const expiryCookie = document.cookie.split('; ').find((row) => row.startsWith('grafana_session_expiry='));
    if (!expiryCookie) {
      return 0;
    }

    let expiresStr = expiryCookie.split('=').at(1);
    if (!expiresStr) {
      return 0;
    }

    return parseInt(expiresStr, 10);
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
