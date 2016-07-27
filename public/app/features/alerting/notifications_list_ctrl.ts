///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from '../../core/core_module';
import config from 'app/core/config';

export class AlertNotificationsListCtrl {

  notifications: any;

  /** @ngInject */
  constructor(private backendSrv, private $scope) {
    this.loadNotifications();
  }

  loadNotifications() {
    this.backendSrv.get(`/api/alert-notifications`).then(result => {
      this.notifications = result;
    });
  }

  deleteNotification(id) {
    this.backendSrv.delete(`/api/alert-notifications/${id}`).then(() => {
      this.notifications = this.notifications.filter(notification => {
        return notification.id !== id;
      });
    });
  }
}

coreModule.controller('AlertNotificationsListCtrl', AlertNotificationsListCtrl);


