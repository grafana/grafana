import config from 'app/core/config';
import _ from 'lodash';
import coreModule from 'app/core/core_module';

export class User {
  id: number;
  isGrafanaAdmin: any;
  isSignedIn: any;
  orgRole: any;
  orgId: number;
  orgName: string;
  orgCount: number;
  timezone: string;
  monthDayFormat: string;
  helpFlags1: number;
  lightTheme: boolean;
  hasEditPermissionInFolders: boolean;

  constructor(user?: any, overrides?: any) {
    _.extend(this, user, overrides);
  }
}

export class ContextSrv {
  pinned: any;
  version: any;
  user: User;
  isSignedIn: any;
  isGrafanaAdmin: any;
  isEditor: any;
  sidemenuSmallBreakpoint = false;
  hasEditPermissionInFolders: boolean;

  constructor() {
    if (!config.bootData) {
      config.bootData = { user: {}, settings: {} };
    }

    // User overrides from URL params
    const userUrlParams: string[] = ['monthDayFormat'];
    const userOverrides = userUrlParams.reduce((acc: any, param) => {
      const match = new RegExp(`${param}=([^&]*)`).exec(location.search);
      if (match) {
        acc[param] = decodeURIComponent(match[1]);
      }
      return acc;
    }, {});

    this.user = new User(config.bootData.user, userOverrides);
    this.isSignedIn = this.user.isSignedIn;
    this.isGrafanaAdmin = this.user.isGrafanaAdmin;
    this.isEditor = this.hasRole('Editor') || this.hasRole('Admin');
    this.hasEditPermissionInFolders = this.user.hasEditPermissionInFolders;
  }

  hasRole(role: string) {
    return this.user.orgRole === role;
  }

  isGrafanaVisible() {
    return !!(document.visibilityState === undefined || document.visibilityState === 'visible');
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
