import { coreModule, NavModelSrv } from 'app/core/core';
import { getBackendSrv } from '@grafana/runtime';

export class AlertNotificationsListCtrl {
  notifications: any;
  navModel: any;

  /** @ngInject */
  constructor(navModelSrv: NavModelSrv) {
    this.loadNotifications();
    this.navModel = navModelSrv.getNav('alerting', 'channels', 0);
  }

  loadNotifications() {
    getBackendSrv()
      .get(`/api/alert-notifications`)
      .then((result: any) => {
        this.notifications = result;
      });
  }

  deleteNotification(id: number) {
    getBackendSrv()
      .delete(`/api/alert-notifications/${id}`)
      .then(() => {
        this.notifications = this.notifications.filter((notification: any) => {
          return notification.id !== id;
        });
      });
  }
}

coreModule.controller('AlertNotificationsListCtrl', AlertNotificationsListCtrl);
