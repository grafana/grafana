import angular from 'angular';
import config from 'app/core/config';
import { backendSrv } from 'app/core/services/backend_srv';
import { NavModelSrv } from 'app/core/core';

export class NewOrgCtrl {
  /** @ngInject */
  constructor($scope: any, $http: any, navModelSrv: NavModelSrv) {
    $scope.navModel = navModelSrv.getNav('admin', 'global-orgs', 0);
    $scope.newOrg = { name: '' };

    $scope.createOrg = () => {
      backendSrv.post('/api/orgs/', $scope.newOrg).then((result: any) => {
        backendSrv.post('/api/user/using/' + result.orgId).then(() => {
          window.location.href = config.appSubUrl + '/org';
        });
      });
    };
  }
}

angular.module('grafana.controllers').controller('NewOrgCtrl', NewOrgCtrl);
