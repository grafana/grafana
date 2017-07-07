define([
  'angular',
  'lodash',
  '../core_module',
  'app/core/store',
  'app/core/config',
],
function (angular, _, coreModule, store, config) {
  'use strict';

  coreModule.default.service('contextSrv', function() {
    var self = this;
    

    function User() {
      if (config.bootData.user) {
        _.extend(this, config.bootData.user);
      }
    }

    this.hasRole = function(role) {
      return this.user.orgRole === role;
    };

    this.setPinnedState = function(val) {
      this.pinned = val;
      store.set('grafana.sidemenu.pinned', val);
    };

    this.toggleSideMenu = function() {
      this.sidemenu = !this.sidemenu;
      if (!this.sidemenu) {
        this.setPinnedState(false);
      }
    };

    this.pinned = store.getBool('grafana.sidemenu.pinned', false);
    if (this.pinned) {
      this.sidemenu = true;
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
    this.systemsMap = window.grafanaBootData.systems;
    this.hostNum = 0;
  });
});
