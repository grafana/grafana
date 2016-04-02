///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import {coreModule} from 'app/core/core';
import _ from 'lodash';

export class ProfileCtrl {
  user: any;
  old_theme: any;
  orgs: any;
  prefs: any;
  userForm: any;
  prefsForm: any;

  timezones: any = [
    {value: '', text: 'Default'},
    {value: 'browser', text: 'Local browser time'},
    {value: 'utc', text: 'UTC'},
  ];
  themes: any = [
    {value: '', text: 'Default'},
    {value: 'dark', text: 'Dark'},
    {value: 'light', text: 'Light'},
  ];

  /** @ngInject **/
  constructor(private $scope, private backendSrv, private contextSrv, private $location) {
    this.getUser();
    this.getUserOrgs();
    this.getUserPrefs();
  }

  getUser() {
    this.backendSrv.get('/api/user').then(user => {
      this.user = user;
      this.user.theme = user.theme || 'dark';
    });
  }

  getUserPrefs() {
    this.backendSrv.get('/api/user/preferences').then(prefs => {
      this.prefs = prefs;
      this.old_theme = prefs.theme;
    });
  }

  getUserOrgs() {
    this.backendSrv.get('/api/user/orgs').then(orgs => {
      this.orgs = orgs;
    });
  }

  setUsingOrg(org) {
    this.backendSrv.post('/api/user/using/' + org.orgId).then(() => {
      window.location.href = config.appSubUrl + '/profile';
    });
  }

  update() {
    if (!this.userForm.$valid) { return; }

    this.backendSrv.put('/api/user/', this.user).then(() => {
      this.contextSrv.user.name = this.user.name || this.user.login;
      if (this.old_theme !== this.user.theme) {
        window.location.href = config.appSubUrl + this.$location.path();
      }
    });
  }

  updatePrefs() {
    if (!this.prefsForm.$valid) { return; }

    var cmd = {
      theme: this.prefs.theme,
      timezone: this.prefs.timezone,
      homeDashboardId: this.prefs.homeDashboardId
    };

    this.backendSrv.put('/api/user/preferences', cmd).then(() => {
      if (this.old_theme !== cmd.theme) {
        window.location.href = config.appSubUrl + this.$location.path();
      }
    });
  }
}

coreModule.controller('ProfileCtrl', ProfileCtrl);
