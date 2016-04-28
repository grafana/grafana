///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from '../../core/core_module';
import config from 'app/core/config';

export class AlertPageCtrl {

  alerts: any;

  /** @ngInject */
  constructor(private backendSrv) {
    this.loadAlerts();
  }

  loadAlerts() {
    this.backendSrv.get('/api/alerts').then(result => {
      this.alerts = result;
    });
  }
}

coreModule.controller('AlertPageCtrl', AlertPageCtrl);

