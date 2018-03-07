///<reference path="../../headers/common.d.ts" />

import config from 'app/core/config';
import angular from 'angular';
import moment from 'moment';
import _ from 'lodash';

import coreModule from 'app/core/core_module';

export class AlertingSrv {
  dashboard: any;
  alerts: any[];

  init(dashboard, alerts) {
    this.dashboard = dashboard;
    this.alerts = alerts || [];
  }
}


coreModule.service('alertingSrv', AlertingSrv);

