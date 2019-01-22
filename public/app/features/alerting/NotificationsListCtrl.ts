import { coreModule } from 'app/core/core';

export class AlertNotificationsListCtrl {
  notifications: any;
  navModel: any;

  /** @ngInject */
  constructor(private backendSrv, navModelSrv) {
    this.loadNotifications();
    this.navModel = navModelSrv.getNav('alerting', 'channels', 0);
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
