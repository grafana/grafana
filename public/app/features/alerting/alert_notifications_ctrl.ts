///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from '../../core/core_module';
import config from 'app/core/config';

export class AlertNotificationsCtrl {

  /** @ngInject */
  constructor(private backendSrv) {
    this.loadNotifications();
  }

  loadNotifications() {
  }
}

coreModule.controller('AlertNotificationsCtrl', AlertNotificationsCtrl);

