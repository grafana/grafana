import config from 'app/core/config';
import { coreModule } from 'app/core/core';

export class ProfileCtrl {
  user: any;
  oldTheme: any;
  teams: any = [];
  orgs: any = [];
  userForm: any;
  showTeamsList = false;
  showOrgsList = false;
  readonlyLoginFields = config.disableLoginForm;
  navModel: any;

  /** @ngInject */
  constructor(private backendSrv, private contextSrv, private $location, navModelSrv) {
    this.getUser();
    this.getUserTeams();
    this.getUserOrgs();
    this.navModel = navModelSrv.getNav('profile', 'profile-settings', 0);
  }

  getUser() {
    this.backendSrv.get('/api/user').then(user => {
      this.user = user;
      this.user.theme = user.theme || 'dark';
    });
  }

  getUserTeams() {
    this.backendSrv.get('/api/user/teams').then(teams => {
      this.teams = teams;
      this.showTeamsList = this.teams.length > 0;
    });
  }

  getUserOrgs() {
    this.backendSrv.get('/api/user/orgs').then(orgs => {
      this.orgs = orgs;
      this.showOrgsList = orgs.length > 1;
    });
  }

  setUsingOrg(org) {
    this.backendSrv.post('/api/user/using/' + org.orgId).then(() => {
      window.location.href = config.appSubUrl + '/profile';
    });
  }

  update() {
    if (!this.userForm.$valid) {
      return;
    }

    this.backendSrv.put('/api/user/', this.user).then(() => {
      this.contextSrv.user.name = this.user.name || this.user.login;
      if (this.oldTheme !== this.user.theme) {
        window.location.href = config.appSubUrl + this.$location.path();
      }
    });
  }
}

coreModule.controller('ProfileCtrl', ProfileCtrl);
