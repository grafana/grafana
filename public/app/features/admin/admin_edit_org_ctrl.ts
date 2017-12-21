import angular from 'angular';

export class AdminEditOrgCtrl {
  /** @ngInject */
  constructor($scope, $routeParams, backendSrv, $location, navModelSrv) {
    $scope.init = function() {
      $scope.navModel = navModelSrv.getNav('cfg', 'admin', 'global-orgs', 1);

      if ($routeParams.id) {
        $scope.getOrg($routeParams.id);
        $scope.getOrgUsers($routeParams.id);
      }
    };

    $scope.getOrg = function(id) {
      backendSrv.get('/api/orgs/' + id).then(function(org) {
        $scope.org = org;
      });
    };

    $scope.getOrgUsers = function(id) {
      backendSrv.get('/api/orgs/' + id + '/users').then(function(orgUsers) {
        $scope.orgUsers = orgUsers;
      });
    };

    $scope.update = function() {
      if (!$scope.orgDetailsForm.$valid) {
        return;
      }

      backendSrv.put('/api/orgs/' + $scope.org.id, $scope.org).then(function() {
        $location.path('/admin/orgs');
      });
    };

    $scope.updateOrgUser = function(orgUser) {
      backendSrv.patch('/api/orgs/' + orgUser.orgId + '/users/' + orgUser.userId, orgUser);
    };

    $scope.removeOrgUser = function(orgUser) {
      backendSrv.delete('/api/orgs/' + orgUser.orgId + '/users/' + orgUser.userId).then(function() {
        $scope.getOrgUsers($scope.org.id);
      });
    };

    $scope.init();
  }
}

angular.module('grafana.controllers').controller('AdminEditOrgCtrl', AdminEditOrgCtrl);
