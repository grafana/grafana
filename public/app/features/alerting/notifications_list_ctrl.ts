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
    this.backendSrv.get(`/api/alerts/notifications`).then(result => {
      this.notifications = result;
    });
  }

  deleteNotification(notificationId) {
    this.backendSrv.delete(`/api/alerts/notification/${notificationId}`)
      .then(() => {
        this.notifications = this.notifications.filter(notification => {
          return notification.id !== notificationId;
        });
        this.$scope.appEvent('alert-success', ['Notification deleted', '']);
      }, () => {
        this.$scope.appEvent('alert-error', ['Unable to delete notification', '']);
      });
  }
}

coreModule.controller('AlertNotificationsListCtrl', AlertNotificationsListCtrl);


