import config from 'app/core/config';
import { coreModule, NavModelSrv } from 'app/core/core';
import { dateTime } from '@grafana/data';
import { UserSession } from 'app/types';
import { BackendSrv } from 'app/core/services/backend_srv';

export class ProfileCtrl {
  user: any;
  oldTheme: any;
  orgs: any = [];
  sessions: object[] = [];
  userForm: any;
  showOrgsList = false;
  readonlyLoginFields = config.disableLoginForm;
  navModel: any;

  /** @ngInject */
  constructor(private backendSrv: BackendSrv, navModelSrv: NavModelSrv) {
    this.getUserSessions();
    this.getUserOrgs();
    this.navModel = navModelSrv.getNav('profile', 'profile-settings', 0);
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

  getUserOrgs() {
    this.backendSrv.get('/api/user/orgs').then((orgs: any) => {
      this.orgs = orgs;
      this.showOrgsList = orgs.length > 1;
    });
  }

  setUsingOrg(org: any) {
    this.backendSrv.post('/api/user/using/' + org.orgId).then(() => {
      window.location.href = config.appSubUrl + '/profile';
    });
  }
}

coreModule.controller('ProfileCtrl', ProfileCtrl);
