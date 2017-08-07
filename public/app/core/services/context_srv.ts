///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import _ from 'lodash';
import coreModule from 'app/core/core_module';
import store from 'app/core/store';

export class User {
  isGrafanaAdmin: any;
  isSignedIn: any;
  orgRole: any;

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
  lightTheme: any;
  isOrgAdmin: any;
  dashboardLink: any;
  systemsMap: any;
  hostNum: any;
  system: any;

  constructor() {
    this.pinned = store.getBool('grafana.sidemenu.pinned', false);
    if (this.pinned) {
      this.sidemenu = true;
    }

    if (!config.buildInfo) {
      config.buildInfo = {};
    }
    if (!config.bootData) {
      config.bootData = {user: {}, settings: {}};
    }

    this.version = config.buildInfo.version;
    this.lightTheme = false;
    this.user = new User();
    this.isSignedIn = this.user.isSignedIn;
    this.isGrafanaAdmin = this.user.isGrafanaAdmin;
    this.isEditor = this.hasRole('Editor') || this.hasRole('Admin');
    this.isOrgAdmin = this.hasRole('Admin');
    this.system = 0;
    this.dashboardLink = "";
    this.systemsMap = config.bootData.systems;
    this.hostNum = 0;
  }

  hasRole(role) {
    return this.user.orgRole === role;
  }

  setPinnedState(val) {
    this.pinned = val;
    store.set('grafana.sidemenu.pinned', val);
  }

  toggleSideMenu() {
    this.sidemenu = !this.sidemenu;
    this.setPinnedState(true);
  }
}

var contextSrv = new ContextSrv();
export {contextSrv};

coreModule.factory('contextSrv', function() {
  return contextSrv;
});
