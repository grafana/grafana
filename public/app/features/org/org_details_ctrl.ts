import angular from 'angular';

export class OrgDetailsCtrl {
  /** @ngInject */
  constructor($scope, $http, backendSrv, contextSrv, navModelSrv) {
    $scope.init = () => {
      $scope.getOrgInfo();
      $scope.navModel = navModelSrv.getNav('cfg', 'org-settings', 0);
    };

    $scope.getOrgInfo = () => {
      backendSrv.get('/api/org').then(org => {
        $scope.org = org;
        $scope.address = org.address;
        contextSrv.user.orgName = org.name;
      });
    };

    $scope.update = () => {
      if (!$scope.orgForm.$valid) {
        return;
      }
      const data = { name: $scope.org.name };
      backendSrv.put('/api/org', data).then($scope.getOrgInfo);
    };

    $scope.updateAddress = () => {
      if (!$scope.addressForm.$valid) {
        return;
      }
      backendSrv.put('/api/org/address', $scope.address).then($scope.getOrgInfo);
    };

    $scope.init();
  }
}

angular.module('grafana.controllers').controller('OrgDetailsCtrl', OrgDetailsCtrl);
