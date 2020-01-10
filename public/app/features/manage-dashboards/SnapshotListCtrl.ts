import _ from 'lodash';
import { ILocationService, IScope } from 'angular';
import { getBackendSrv } from '@grafana/runtime';

import { NavModelSrv } from 'app/core/core';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { CoreEvents } from 'app/types';
import { promiseToDigest } from '../../core/utils/promiseToDigest';

export class SnapshotListCtrl {
  navModel: any;
  snapshots: any;

  /** @ngInject */
  constructor(
    private $rootScope: GrafanaRootScope,
    navModelSrv: NavModelSrv,
    private $location: ILocationService,
    private $scope: IScope
  ) {
    this.navModel = navModelSrv.getNav('dashboards', 'snapshots', 0);
    promiseToDigest(this.$scope)(
      getBackendSrv()
        .get('/api/dashboard/snapshots')
        .then((result: any) => {
          const baseUrl = this.$location.absUrl().replace($location.url(), '');
          this.snapshots = result.map((snapshot: any) => ({
            ...snapshot,
            url: snapshot.externalUrl || `${baseUrl}/dashboard/snapshot/${snapshot.key}`,
          }));
        })
    );
  }

  removeSnapshotConfirmed(snapshot: any) {
    _.remove(this.snapshots, { key: snapshot.key });
    promiseToDigest(this.$scope)(
      getBackendSrv()
        .delete('/api/snapshots/' + snapshot.key)
        .then(
          () => {},
          () => {
            this.snapshots.push(snapshot);
          }
        )
    );
  }

  removeSnapshot(snapshot: any) {
    this.$rootScope.appEvent(CoreEvents.showConfirmModal, {
      title: 'Delete',
      text: 'Are you sure you want to delete snapshot ' + snapshot.name + '?',
      yesText: 'Delete',
      icon: 'fa-trash',
      onConfirm: () => {
        this.removeSnapshotConfirmed(snapshot);
      },
    });
  }
}
