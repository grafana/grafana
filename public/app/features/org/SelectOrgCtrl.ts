import angular from 'angular';
import config from 'app/core/config';
import { getBackendSrv } from '@grafana/runtime';
import { promiseToDigest } from 'app/core/utils/promiseToDigest';

export class SelectOrgCtrl {
  /** @ngInject */
  constructor($scope: any, contextSrv: any) {
    contextSrv.sidemenu = false;

    $scope.navModel = {
      main: {
        icon: 'grafana',
        subTitle: 'Preferences',
        text: 'Select active organization',
      },
    };

    $scope.init = () => {
      $scope.getUserOrgs();
    };

    $scope.getUserOrgs = () => {
      promiseToDigest($scope)(
        getBackendSrv()
          .get('/api/user/orgs')
          .then((orgs: any) => {
            $scope.orgs = orgs;
          })
      );
    };

    $scope.setUsingOrg = (org: any) => {
      getBackendSrv()
        .post('/api/user/using/' + org.orgId)
        .then(() => {
          window.location.href = config.appSubUrl + '/';
        });
    };

    $scope.init();
  }
}

angular.module('grafana.controllers').controller('SelectOrgCtrl', SelectOrgCtrl);
