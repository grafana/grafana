import { coreModule, NavModelSrv } from 'app/core/core';
import { dateTime } from '@grafana/data';
import { UserSession } from 'app/types';
import { getBackendSrv } from '@grafana/runtime';
import { promiseToDigest } from 'app/core/utils/promiseToDigest';

export class ProfileCtrl {
  sessions: object[] = [];
  navModel: any;
  digest: (promise: Promise<any>) => Promise<any>;

  /** @ngInject */
  constructor($scope: any, navModelSrv: NavModelSrv) {
    this.getUserSessions();
    this.navModel = navModelSrv.getNav('profile', 'profile-settings', 0);
    this.digest = promiseToDigest($scope);
  }

  getUserSessions() {
    this.digest(
      getBackendSrv()
        .get('/api/user/auth-tokens')
        .then((sessions: UserSession[]) => {
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
        })
    );
  }

  revokeUserSession(tokenId: number) {
    this.digest(
      getBackendSrv()
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
        })
    );
  }
}

coreModule.controller('ProfileCtrl', ProfileCtrl);
