///<reference path="../../headers/common.d.ts" />

import config = require('app/core/config');
import angular from 'angular';

export class AppListCtrl {
  apps: any[];

  /** @ngInject */
  constructor(private appSrv: any) {}

  init() {
    this.appSrv.getAll().then(result => {
      this.apps = result;
    });
  }
}

angular.module('grafana.controllers').controller('AppListCtrl', AppListCtrl);
