///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from '../../core/core_module';
import config from 'app/core/config';
import alertDef from './alert_def';

export class AlertPageCtrl {

  alerts: any;

  /** @ngInject */
  constructor(private backendSrv) {
    this.loadAlerts();
  }

  loadAlerts() {
    this.backendSrv.get('/api/alerts').then(result => {
      this.alerts = _.map(result, alert => {
        alert.iconCss = alertDef.getCssForState(alert.state);
        return alert;
      });
    });
  }

  deleteAlert(alert) {
    this.backendSrv.delete('/api/alerts/' + alert.id).then(result => {
      if (result.alertId) {
        this.alerts = this.alerts.filter(alert => {
          return alert.id !== result.alertId;
        });
      }
    });
  }
}

coreModule.controller('AlertPageCtrl', AlertPageCtrl);

