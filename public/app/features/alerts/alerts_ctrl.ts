///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from '../../core/core_module';
import config from 'app/core/config';

export class AlertPageCtrl {

  alerts: any;
  /** @ngInject */
  constructor(private $scope, private backendSrv) {
    console.log('ctor!');
    this.loadAlerts();
  }

  loadAlerts() {
    this.backendSrv.get('/api/alert_rule').then(result => {
      console.log(result);
      this.alerts = result;
    });
  }
}

coreModule.controller('AlertPageCtrl', AlertPageCtrl);

