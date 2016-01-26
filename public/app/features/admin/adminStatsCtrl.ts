//<reference path="../../headers/common.d.ts" />

import angular from 'angular';

export class AdminStatsCtrl {
  stats: any;

  /** @ngInject */
  constructor(private backendSrv: any) {}

  init() {
    this.backendSrv.get('/api/admin/stats').then(stats => {
      this.stats = stats;
    });
  }
}

angular.module('grafana.controllers').controller('AdminStatsCtrl', AdminStatsCtrl);
