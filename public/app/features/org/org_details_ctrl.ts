import angular from 'angular';

export class OrgDetailsCtrl {
  /** @ngInject **/
  constructor($scope, $http, backendSrv, contextSrv, navModelSrv) {
    $scope.init = function() {
      $scope.getOrgInfo();
      $scope.navModel = navModelSrv.getNav('cfg', 'org-settings', 0);
    };

    $scope.getOrgInfo = function() {
      backendSrv.get('/api/org').then(function(org) {
        $scope.org = org;
        $scope.address = org.address;
        contextSrv.user.orgName = org.name;
      });
    };

    $scope.update = function() {
      if (!$scope.orgForm.$valid) {
        return;
      }
      var data = { name: $scope.org.name };
      backendSrv.put('/api/org', data).then($scope.getOrgInfo);
    };

    $scope.updateAddress = function() {
      if (!$scope.addressForm.$valid) {
        return;
      }
      backendSrv.put('/api/org/address', $scope.address).then($scope.getOrgInfo);
    };

    $scope.init();
  }
}

angular.module('grafana.controllers').controller('OrgDetailsCtrl', OrgDetailsCtrl);
