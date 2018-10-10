import config from 'app/core/config';
import _ from 'lodash';
import coreModule from 'app/core/core_module';
import store from 'app/core/store';

export class User {
  isGrafanaAdmin: any;
  isSignedIn: any;
  orgRole: any;
  orgId: number;
  orgName: string;
  orgCount: number;
  timezone: string;
  helpFlags1: number;
  lightTheme: boolean;
  hasEditPermissionInFolders: boolean;
  monthDayFormat: string;

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
  sidemenu: any;
  sidemenuSmallBreakpoint = false;
  hasEditPermissionInFolders: boolean;

  constructor() {
    this.sidemenu = store.getBool('grafana.sidemenu', true);

    if (!config.bootData) {
      config.bootData = { user: {}, settings: {} };
    }

    // User overrides from URL params
    const userUrlParams = ['monthDayFormat'];
    const userOverrides = userUrlParams.reduce((acc, param) => {
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

  hasRole(role) {
    return this.user.orgRole === role;
  }

  isGrafanaVisible() {
    return !!(document.visibilityState === undefined || document.visibilityState === 'visible');
  }

  toggleSideMenu() {
    this.sidemenu = !this.sidemenu;
    store.set('grafana.sidemenu', this.sidemenu);
  }
}

const contextSrv = new ContextSrv();
export { contextSrv };

coreModule.factory('contextSrv', () => {
  return contextSrv;
});
