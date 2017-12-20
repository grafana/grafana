import config from 'app/core/config';
import _ from 'lodash';
import coreModule from 'app/core/core_module';
import store from 'app/core/store';

export class User {
  isGrafanaAdmin: any;
  isSignedIn: any;
  orgRole: any;
  orgId: number;
  timezone: string;
  helpFlags1: number;
  lightTheme: boolean;

  constructor() {
    if (config.bootData.user) {
      _.extend(this, config.bootData.user);
    }
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

  constructor() {
    this.sidemenu = store.getBool('grafana.sidemenu', true);

    if (!config.buildInfo) {
      config.buildInfo = {};
    }
    if (!config.bootData) {
      config.bootData = { user: {}, settings: {} };
    }

    this.version = config.buildInfo.version;
    this.user = new User();
    this.isSignedIn = this.user.isSignedIn;
    this.isGrafanaAdmin = this.user.isGrafanaAdmin;
    this.isEditor = this.hasRole('Editor') || this.hasRole('Admin');
  }

  hasRole(role) {
    return this.user.orgRole === role;
  }

  isGrafanaVisible() {
    return !!(
      document.visibilityState === undefined ||
      document.visibilityState === 'visible'
    );
  }

  toggleSideMenu() {
    this.sidemenu = !this.sidemenu;
    store.set('grafana.sidemenu', this.sidemenu);
  }
}

var contextSrv = new ContextSrv();
export { contextSrv };

coreModule.factory('contextSrv', function() {
  return contextSrv;
});
