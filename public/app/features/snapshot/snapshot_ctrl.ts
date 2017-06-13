///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

export class SnapshotsCtrl {
  navModel: any;
  snapshots: any;

  /** @ngInject */
  constructor(private $rootScope, private backendSrv) {
    this.navModel = {
      section: {
        title: 'Snapshots',
        icon:  'icon-gf icon-gf-snapshot',
        url: 'dashboard/snapshots',
      },
      menu: [],
    };

    this.backendSrv.get('/api/dashboard/snapshots').then(result => {
      this.snapshots = result;
    });
  }

  removeSnapshotConfirmed(snapshot) {
    _.remove(this.snapshots, {key: snapshot.key});
    this.backendSrv.get('/api/snapshots-delete/' + snapshot.deleteKey)
    .then(() => {
      this.$rootScope.appEvent('alert-success', ['Snapshot deleted', '']);
    }, () => {
      this.$rootScope.appEvent('alert-error', ['Unable to delete snapshot', '']);
      this.snapshots.push(snapshot);
    });
  }

  removeSnapshot(snapshot) {
    this.$rootScope.appEvent('confirm-modal', {
      title: 'Delete',
      text: 'Are you sure you want to delete snapshot ' + snapshot.name + '?',
      yesText: "Delete",
      icon: "fa-trash",
      onConfirm: () => {
        this.removeSnapshotConfirmed(snapshot);
      }
    });
  }

}

angular.module('grafana.controllers').controller('SnapshotsCtrl', SnapshotsCtrl);
