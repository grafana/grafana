import angular from 'angular';
import config from 'app/core/config';

export class NewOrgCtrl {
  /** @ngInject **/
  constructor($scope, $http, backendSrv, navModelSrv) {
    $scope.navModel = navModelSrv.getNav('cfg', 'admin', 'global-orgs', 1);
    $scope.newOrg = { name: '' };

    $scope.createOrg = function() {
      backendSrv.post('/api/orgs/', $scope.newOrg).then(function(result) {
        backendSrv.post('/api/user/using/' + result.orgId).then(function() {
          window.location.href = config.appSubUrl + '/org';
        });
      });
    };
  }
}

angular.module('grafana.controllers').controller('NewOrgCtrl', NewOrgCtrl);
