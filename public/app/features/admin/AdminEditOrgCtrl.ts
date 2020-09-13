import { getBackendSrv } from '@grafana/runtime';
import { NavModelSrv } from 'app/core/core';
import { promiseToDigest } from 'app/core/utils/promiseToDigest';

export default class AdminEditOrgCtrl {
  /** @ngInject */
  constructor($scope: any, $routeParams: any, $location: any, navModelSrv: NavModelSrv) {
    $scope.init = () => {
      $scope.navModel = navModelSrv.getNav('admin', 'global-orgs', 0);

      if ($routeParams.id) {
        promiseToDigest($scope)(Promise.all([$scope.getOrg($routeParams.id), $scope.getOrgUsers($routeParams.id)]));
      }
    };

    $scope.getOrg = (id: number) => {
      return getBackendSrv()
        .get('/api/orgs/' + id)
        .then((org: any) => {
          $scope.org = org;
        });
    };

    $scope.getOrgUsers = (id: number) => {
      return getBackendSrv()
        .get('/api/orgs/' + id + '/users')
        .then((orgUsers: any) => {
          $scope.orgUsers = orgUsers;
        });
    };

    $scope.update = () => {
      if (!$scope.orgDetailsForm.$valid) {
        return;
      }

      promiseToDigest($scope)(
        getBackendSrv()
          .put('/api/orgs/' + $scope.org.id, $scope.org)
          .then(() => {
            $location.path('/admin/orgs');
          })
      );
    };

    $scope.updateOrgUser = (orgUser: any) => {
      getBackendSrv().patch('/api/orgs/' + orgUser.orgId + '/users/' + orgUser.userId, orgUser);
    };

    $scope.removeOrgUser = (orgUser: any) => {
      promiseToDigest($scope)(
        getBackendSrv()
          .delete('/api/orgs/' + orgUser.orgId + '/users/' + orgUser.userId)
          .then(() => $scope.getOrgUsers($scope.org.id))
      );
    };

    $scope.init();
  }
}
