import _ from 'lodash';

export default class AdminEditUserCtrl {
  /** @ngInject */
  constructor($scope, $routeParams, backendSrv, $location, navModelSrv) {
    $scope.user = {};
    $scope.newOrg = { name: '', role: 'Editor' };
    $scope.permissions = {};
    $scope.navModel = navModelSrv.getNav('admin', 'global-users', 0);

    $scope.init = () => {
      if ($routeParams.id) {
        $scope.getUser($routeParams.id);
        $scope.getUserOrgs($routeParams.id);
      }
    };

    $scope.getUser = id => {
      backendSrv.get('/api/users/' + id).then(user => {
        $scope.user = user;
        $scope.user_id = id;
        $scope.permissions.isGrafanaAdmin = user.isGrafanaAdmin;
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

      backendSrv.put('/api/admin/users/' + $scope.user_id + '/permissions', payload).then(() => {
        $location.path('/admin/users');
      });
    };

    $scope.create = () => {
      if (!$scope.userForm.$valid) {
        return;
      }

      backendSrv.post('/api/admin/users', $scope.user).then(() => {
        $location.path('/admin/users');
      });
    };

    $scope.getUserOrgs = id => {
      backendSrv.get('/api/users/' + id + '/orgs').then(orgs => {
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

    $scope.updateOrgUser = orgUser => {
      backendSrv.patch('/api/orgs/' + orgUser.orgId + '/users/' + $scope.user_id, orgUser).then(() => {});
    };

    $scope.removeOrgUser = orgUser => {
      backendSrv.delete('/api/orgs/' + orgUser.orgId + '/users/' + $scope.user_id).then(() => {
        $scope.getUser($scope.user_id);
        $scope.getUserOrgs($scope.user_id);
      });
    };

    $scope.orgsSearchCache = [];

    $scope.searchOrgs = (queryStr, callback) => {
      if ($scope.orgsSearchCache.length > 0) {
        callback(_.map($scope.orgsSearchCache, 'name'));
        return;
      }

      backendSrv.get('/api/orgs', { query: '' }).then(result => {
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

    $scope.init();
  }
}
