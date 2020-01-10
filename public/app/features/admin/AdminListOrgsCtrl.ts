import { getBackendSrv } from '@grafana/runtime';
import { NavModelSrv } from 'app/core/core';
import { Scope, CoreEvents, AppEventEmitter } from 'app/types';
import { promiseToDigest } from 'app/core/utils/promiseToDigest';

export default class AdminListOrgsCtrl {
  /** @ngInject */
  constructor($scope: Scope & AppEventEmitter, navModelSrv: NavModelSrv) {
    $scope.init = async () => {
      $scope.navModel = navModelSrv.getNav('admin', 'global-orgs', 0);
      await $scope.getOrgs();
    };

    $scope.getOrgs = async () => {
      const orgs = await promiseToDigest($scope)(getBackendSrv().get('/api/orgs'));
      $scope.orgs = orgs;
    };

    $scope.deleteOrg = (org: any) => {
      $scope.appEvent(CoreEvents.showConfirmModal, {
        title: 'Delete',
        text: `Do you want to delete organization ${org.name}?`,
        text2: 'All dashboards for this organization will be removed!',
        icon: 'fa-trash',
        yesText: 'Delete',
        onConfirm: async () => {
          await getBackendSrv().delete('/api/orgs/' + org.id);
          await $scope.getOrgs();
        },
      });
    };

    $scope.init();
  }
}
