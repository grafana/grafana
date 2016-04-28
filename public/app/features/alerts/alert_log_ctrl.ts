///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from '../../core/core_module';
import config from 'app/core/config';

export class AlertLogCtrl {

  alertLogs: any;
  alert: any;
  alertId: any;

  /** @ngInject */
  constructor(private $route, private backendSrv) {
    if ($route.current.params.alertId) {
      this.alertId = $route.current.params.alertId;
      this.loadAlertLogs();
    }
  }

  loadAlertLogs() {
    this.backendSrv.get('/api/alerts/events/' + this.alertId).then(result => {
      console.log(result);
      this.alertLogs = result;
    });

    this.backendSrv.get('/api/alerts/' + this.alertId).then(result => {
      this.alert = result;
    });
  }
}

coreModule.controller('AlertLogCtrl', AlertLogCtrl);
