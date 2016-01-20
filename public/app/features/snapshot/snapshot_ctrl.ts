///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';

export class SnapshotsCtrl {
  snapshots: any[];

  /** @ngInject */
  constructor(private backendSrv: any) {}

  init() {
    this.backendSrv.get('/api/dashboard/snapshots').then(snapshots => {
      this.snapshots = snapshots;
    });
    console.log(this.snapshots);
  }
}
  
angular.module('grafana.controllers').controller('SnapshotsCtrl', SnapshotsCtrl);
