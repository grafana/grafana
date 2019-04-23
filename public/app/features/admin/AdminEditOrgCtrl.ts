export default class AdminEditOrgCtrl {
  /** @ngInject */
  constructor($scope, $routeParams, backendSrv, $location, navModelSrv) {
    $scope.init = () => {
      $scope.navModel = navModelSrv.getNav('admin', 'global-orgs', 0);

      if ($routeParams.id) {
        $scope.getOrg($routeParams.id);
        $scope.getOrgUsers($routeParams.id);
      }
    };

    $scope.getOrg = id => {
      backendSrv.get('/api/orgs/' + id).then(org => {
        $scope.org = org;
      });
    };

    $scope.getOrgUsers = id => {
      backendSrv.get('/api/orgs/' + id + '/users').then(orgUsers => {
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

    $scope.updateOrgUser = orgUser => {
      backendSrv.patch('/api/orgs/' + orgUser.orgId + '/users/' + orgUser.userId, orgUser);
    };

    $scope.removeOrgUser = orgUser => {
      backendSrv.delete('/api/orgs/' + orgUser.orgId + '/users/' + orgUser.userId).then(() => {
        $scope.getOrgUsers($scope.org.id);
      });
    };

    $scope.init();
  }
}
