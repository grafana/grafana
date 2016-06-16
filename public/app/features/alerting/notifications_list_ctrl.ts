///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from '../../core/core_module';
import config from 'app/core/config';

export class AlertNotificationsListCtrl {

  notifications: any;

  /** @ngInject */
  constructor(private backendSrv) {
    this.loadNotifications();
  }

  loadNotifications() {
    this.backendSrv.get(`/api/alerts/notifications`).then(result => {
      this.notifications = result;
    });
  }
}

coreModule.controller('AlertNotificationsListCtrl', AlertNotificationsListCtrl);

