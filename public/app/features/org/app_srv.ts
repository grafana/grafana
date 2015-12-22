///<reference path="../../headers/common.d.ts" />

import config = require('app/core/config');
import angular from 'angular';

export class AppSrv {
  apps: any = {};

  /** @ngInject */
  constructor(
    private $rootScope,
    private $timeout,
    private $q,
    private backendSrv) {
  }

  get(type) {
    if (this.apps[type]) {
      return this.$q.when(this.apps[type]);
    }
    return this.getAll().then(() => {
      return this.apps[type];
    });
  }

  getAll() {
    if (!_.isEmpty(this.apps)) {
      return this.$q.when(this.apps);
    }

    return this.backendSrv.get('api/org/apps').then(results => {
      return results.reduce((prev, current) => {
        prev[current.type] = current;
        return prev;
      }, this.apps);
    });
  }

  update(app) {
    return this.backendSrv.post('api/org/apps', app).then(resp => {
      this.apps[app.type] = app;
    });
  }
}

angular.module('grafana.services').service('appSrv', AppSrv);
