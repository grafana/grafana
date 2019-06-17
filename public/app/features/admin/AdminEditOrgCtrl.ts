import { BackendSrv } from 'app/core/services/backend_srv';
import { NavModelSrv } from 'app/core/core';

export default class AdminEditOrgCtrl {
  /** @ngInject */
  constructor($scope: any, $routeParams: any, backendSrv: BackendSrv, $location: any, navModelSrv: NavModelSrv) {
    $scope.init = () => {
      $scope.navModel = navModelSrv.getNav('admin', 'global-orgs', 0);

      if ($routeParams.id) {
        $scope.getOrg($routeParams.id);
        $scope.getOrgUsers($routeParams.id);
      }
    };

    $scope.getOrg = (id: number) => {
      backendSrv.get('/api/orgs/' + id).then((org: any) => {
        $scope.org = org;
      });
    };

    $scope.getOrgUsers = (id: number) => {
      backendSrv.get('/api/orgs/' + id + '/users').then((orgUsers: any) => {
        $scope.orgUsers = orgUsers;
      });
    };

    $scope.update = () => {
      if (!$scope.orgDetailsForm.$valid) {
        return;
      }

      backendSrv.put('/api/orgs/' + $scope.org.id, $scope.org).then(() => {
        $location.path('/admin/orgs');
      });
    };

    $scope.updateOrgUser = (orgUser: any) => {
      backendSrv.patch('/api/orgs/' + orgUser.orgId + '/users/' + orgUser.userId, orgUser);
    };

    $scope.removeOrgUser = (orgUser: any) => {
      backendSrv.delete('/api/orgs/' + orgUser.orgId + '/users/' + orgUser.userId).then(() => {
        $scope.getOrgUsers($scope.org.id);
      });
    };

    $scope.init();
  }
}
