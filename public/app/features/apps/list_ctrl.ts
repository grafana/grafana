///<reference path="../../headers/common.d.ts" />

import angular from 'angular';

export class AppListCtrl {
  apps: any[];

  /** @ngInject */
  constructor(private backendSrv: any) {

    this.backendSrv.get('api/org/apps').then(apps => {
      this.apps = apps;
    });
  }
}

angular.module('grafana.controllers').controller('AppListCtrl', AppListCtrl);
