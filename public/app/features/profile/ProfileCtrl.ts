import config from 'app/core/config';
import { coreModule } from 'app/core/core';
import { dateTime } from '@grafana/ui';
import { UserSession } from 'app/types';

export class ProfileCtrl {
  user: any;
  oldTheme: any;
  teams: any = [];
  orgs: any = [];
  sessions: object[] = [];
  userForm: any;
  showTeamsList = false;
  showOrgsList = false;
  readonlyLoginFields = config.disableLoginForm;
  navModel: any;

  /** @ngInject */
  constructor(private backendSrv, private contextSrv, private $location, navModelSrv) {
    this.getUser();
    this.getUserSessions();
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

  getUserSessions() {
    this.backendSrv.get('/api/user/auth-tokens').then((sessions: UserSession[]) => {
      sessions.reverse();

      const found = sessions.findIndex((session: UserSession) => {
        return session.isActive;
      });

      if (found) {
        const now = sessions[found];
        sessions.splice(found, found);
        sessions.unshift(now);
      }

      this.sessions = sessions.map((session: UserSession) => {
        return {
          id: session.id,
          isActive: session.isActive,
          seenAt: dateTime(session.seenAt).fromNow(),
          createdAt: dateTime(session.createdAt).format('MMMM DD, YYYY'),
          clientIp: session.clientIp,
          browser: session.browser,
          browserVersion: session.browserVersion,
          os: session.os,
          osVersion: session.osVersion,
          device: session.device,
        };
      });
    });
  }

  revokeUserSession(tokenId: number) {
    this.backendSrv
      .post('/api/user/revoke-auth-token', {
        authTokenId: tokenId,
      })
      .then(() => {
        this.sessions = this.sessions.filter((session: UserSession) => {
          if (session.id === tokenId) {
            return false;
          }
          return true;
        });
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
