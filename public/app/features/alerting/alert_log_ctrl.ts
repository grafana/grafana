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

  /** @ngInject */
  constructor(private $route, private backendSrv) {
    if ($route.current.params.alertId) {
      this.loadAlertLogs($route.current.params.alertId);
    }
  }

  loadAlertLogs(alertId: number) {
    this.backendSrv.get(`/api/alerts/${alertId}/states`).then(result => {
      this.alertLogs = _.map(result, log => {
        log.iconCss = alertDef.getCssForState(log.state);
        log.humanTime = moment(log.created).format("YYYY-MM-DD HH:mm:ss");
        return log;
      });
    });

    this.backendSrv.get(`/api/alerts/${alertId}`).then(result => {
      this.alert = result;
    });
  }
}

coreModule.controller('AlertLogCtrl', AlertLogCtrl);
