///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from '../../core/core_module';
import config from 'app/core/config';
import alertDef from './alert_def';
import moment from 'moment';

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
      this.alertLogs = result;

      _.each(this.alertLogs, log => {
        log.iconCss = alertDef.getCssForState(log.newState);
        log.humanTime = moment(log.created).format("YYYY-MM-DD HH:mm:ss");
      });
    });

    this.backendSrv.get('/api/alerts/' + this.alertId).then(result => {
      this.alert = result;
    });
  }
}

coreModule.controller('AlertLogCtrl', AlertLogCtrl);
