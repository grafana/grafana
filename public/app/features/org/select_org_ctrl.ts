import angular from 'angular';
import config from 'app/core/config';

export class SelectOrgCtrl {
  /** @ngInject */
  constructor($scope, backendSrv, contextSrv) {
    contextSrv.sidemenu = false;

    $scope.navModel = {
      main: {
        icon: 'gicon gicon-branding',
        subTitle: 'Preferences',
        text: 'Select active organization',
      },
    };

    $scope.init = () => {
      $scope.getUserOrgs();
    };

    $scope.getUserOrgs = () => {
      backendSrv.get('/api/user/orgs').then(orgs => {
        $scope.orgs = orgs;
      });
    };

    $scope.setUsingOrg = org => {
      backendSrv.post('/api/user/using/' + org.orgId).then(() => {
        window.location.href = config.appSubUrl + '/';
      });
    };

    $scope.init();
  }
}

angular.module('grafana.controllers').controller('SelectOrgCtrl', SelectOrgCtrl);
