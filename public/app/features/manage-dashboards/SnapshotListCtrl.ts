import _ from 'lodash';
import { NavModelSrv } from 'app/core/core';
import { ILocationService } from 'angular';
import { BackendSrv } from '@grafana/runtime';
import { GrafanaRootScope } from 'app/routes/GrafanaCtrl';
import { CoreEvents } from 'app/types';

export class SnapshotListCtrl {
  navModel: any;
  snapshots: any;

  /** @ngInject */
  constructor(
    private $rootScope: GrafanaRootScope,
    private backendSrv: BackendSrv,
    navModelSrv: NavModelSrv,
    private $location: ILocationService
  ) {
    this.navModel = navModelSrv.getNav('dashboards', 'snapshots', 0);
    this.backendSrv.get('/api/dashboard/snapshots').then((result: any) => {
      const baseUrl = this.$location.absUrl().replace($location.url(), '');
      this.snapshots = result.map((snapshot: any) => ({
        ...snapshot,
        url: snapshot.externalUrl || `${baseUrl}/dashboard/snapshot/${snapshot.key}`,
      }));
    });
  }

  removeSnapshotConfirmed(snapshot: any) {
    _.remove(this.snapshots, { key: snapshot.key });
    this.backendSrv.delete('/api/snapshots/' + snapshot.key).then(
      () => {},
      () => {
        this.snapshots.push(snapshot);
      }
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
