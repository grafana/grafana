import _ from 'lodash';

export class SnapshotListCtrl {
  navModel: any;
  snapshots: any;

  /** @ngInject */
  constructor(private $rootScope, private backendSrv, navModelSrv, private $location) {
    this.navModel = navModelSrv.getNav('dashboards', 'snapshots', 0);
    this.backendSrv.get('/api/dashboard/snapshots').then(result => {
      const baseUrl = this.$location.absUrl().replace($location.url(), '');
      this.snapshots = result.map(snapshot => ({
        ...snapshot,
        url: snapshot.externalUrl || `${baseUrl}/dashboard/snapshot/${snapshot.key}`,
      }));
    });
  }

  removeSnapshotConfirmed(snapshot) {
    _.remove(this.snapshots, { key: snapshot.key });
    this.backendSrv.delete('/api/snapshots/' + snapshot.key).then(
      () => {},
      () => {
        this.snapshots.push(snapshot);
      }
    );
  }

  removeSnapshot(snapshot) {
    this.$rootScope.appEvent('confirm-modal', {
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
