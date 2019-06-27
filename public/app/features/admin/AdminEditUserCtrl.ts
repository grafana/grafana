import _ from 'lodash';
import { dateTime } from '@grafana/ui';
import { BackendSrv } from 'app/core/services/backend_srv';
import { NavModelSrv } from 'app/core/core';
import { User } from 'app/core/services/context_srv';
import { UserSession } from 'app/types';

export default class AdminEditUserCtrl {
  /** @ngInject */
  constructor($scope: any, $routeParams: any, backendSrv: BackendSrv, $location: any, navModelSrv: NavModelSrv) {
    $scope.user = {};
    $scope.sessions = [];
    $scope.newOrg = { name: '', role: 'Editor' };
    $scope.permissions = {};
    $scope.navModel = navModelSrv.getNav('admin', 'global-users', 0);

    $scope.init = () => {
      if ($routeParams.id) {
        $scope.getUser($routeParams.id);
        $scope.getUserSessions($routeParams.id);
        $scope.getUserOrgs($routeParams.id);
      }
    };

    $scope.getUser = (id: number) => {
      backendSrv.get('/api/users/' + id).then((user: User) => {
        $scope.user = user;
        $scope.user_id = id;
        $scope.permissions.isGrafanaAdmin = user.isGrafanaAdmin;
      });
    };

    $scope.getUserSessions = (id: number) => {
      backendSrv.get('/api/admin/users/' + id + '/auth-tokens').then((sessions: UserSession[]) => {
        sessions.reverse();

        $scope.sessions = sessions.map((session: UserSession) => {
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
    };

    $scope.revokeUserSession = (tokenId: number) => {
      backendSrv
        .post('/api/admin/users/' + $scope.user_id + '/revoke-auth-token', {
          authTokenId: tokenId,
        })
        .then(() => {
          $scope.sessions = $scope.sessions.filter((session: UserSession) => {
            if (session.id === tokenId) {
              return false;
            }
            return true;
          });
        });
    };

    $scope.revokeAllUserSessions = (tokenId: number) => {
      backendSrv.post('/api/admin/users/' + $scope.user_id + '/logout').then(() => {
        $scope.sessions = [];
      });
    };

    $scope.setPassword = () => {
      if (!$scope.passwordForm.$valid) {
        return;
      }

      const payload = { password: $scope.password };
      backendSrv.put('/api/admin/users/' + $scope.user_id + '/password', payload).then(() => {
        $location.path('/admin/users');
      });
    };

    $scope.updatePermissions = () => {
      const payload = $scope.permissions;

      backendSrv.put('/api/admin/users/' + $scope.user_id + '/permissions', payload);
    };

    $scope.create = () => {
      if (!$scope.userForm.$valid) {
        return;
      }

      backendSrv.post('/api/admin/users', $scope.user).then(() => {
        $location.path('/admin/users');
      });
    };

    $scope.getUserOrgs = (id: number) => {
      backendSrv.get('/api/users/' + id + '/orgs').then((orgs: any) => {
        $scope.orgs = orgs;
      });
    };

    $scope.update = () => {
      if (!$scope.userForm.$valid) {
        return;
      }

      backendSrv.put('/api/users/' + $scope.user_id, $scope.user).then(() => {
        $location.path('/admin/users');
      });
    };

    $scope.updateOrgUser = (orgUser: { orgId: string }) => {
      backendSrv.patch('/api/orgs/' + orgUser.orgId + '/users/' + $scope.user_id, orgUser).then(() => {});
    };

    $scope.removeOrgUser = (orgUser: { orgId: string }) => {
      backendSrv.delete('/api/orgs/' + orgUser.orgId + '/users/' + $scope.user_id).then(() => {
        $scope.getUser($scope.user_id);
        $scope.getUserOrgs($scope.user_id);
      });
    };

    $scope.orgsSearchCache = [];

    $scope.searchOrgs = (queryStr: any, callback: any) => {
      if ($scope.orgsSearchCache.length > 0) {
        callback(_.map($scope.orgsSearchCache, 'name'));
        return;
      }

      backendSrv.get('/api/orgs', { query: '' }).then((result: any) => {
        $scope.orgsSearchCache = result;
        callback(_.map(result, 'name'));
      });
    };

    $scope.addOrgUser = () => {
      if (!$scope.addOrgForm.$valid) {
        return;
      }

      const orgInfo: any = _.find($scope.orgsSearchCache, {
        name: $scope.newOrg.name,
      });

      if (!orgInfo) {
        return;
      }

      $scope.newOrg.loginOrEmail = $scope.user.login;

      backendSrv.post('/api/orgs/' + orgInfo.id + '/users/', $scope.newOrg).then(() => {
        $scope.getUser($scope.user_id);
        $scope.getUserOrgs($scope.user_id);
      });
    };

    $scope.deleteUser = (user: any) => {
      $scope.appEvent('confirm-modal', {
        title: 'Delete',
        text: 'Do you want to delete ' + user.login + '?',
        icon: 'fa-trash',
        yesText: 'Delete',
        onConfirm: () => {
          backendSrv.delete('/api/admin/users/' + user.id).then(() => {
            $location.path('/admin/users');
          });
        },
      });
    };

    $scope.disableUser = event => {
      const user = $scope.user;

      // External user can not be disabled
      if (user.authModule) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      const actionEndpoint = user.isDisabled ? '/enable' : '/disable';
      backendSrv.post('/api/admin/users/' + user.id + actionEndpoint).then(() => {
        $scope.init();
      });
    };

    $scope.init();
  }
}
