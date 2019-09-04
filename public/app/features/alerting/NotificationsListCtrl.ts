import { coreModule, NavModelSrv } from 'app/core/core';
import { BackendSrv } from 'app/core/services/backend_srv';

export class AlertNotificationsListCtrl {
  notifications: any;
  navModel: any;

  emptyListCta = {
    title: 'There are no notification channels defined yet',
    buttonIcon: 'gicon gicon-alert-notification-channel',
    buttonLink: 'alerting/notification/new',
    buttonTitle: 'Add channel',
    proTip: 'You can include images in your alert notifications.',
    proTipLink: 'http://docs.grafana.org/alerting/notifications/',
    proTipLinkTitle: 'Learn more',
    proTipTarget: '_blank',
  };

  /** @ngInject */
  constructor(private backendSrv: BackendSrv, navModelSrv: NavModelSrv) {
    this.loadNotifications();
    this.navModel = navModelSrv.getNav('alerting', 'channels', 0);
  }

  loadNotifications() {
    this.backendSrv.get(`/api/alert-notifications`).then((result: any) => {
      this.notifications = result;
    });
  }

  deleteNotification(id: number) {
    this.backendSrv.delete(`/api/alert-notifications/${id}`).then(() => {
      this.notifications = this.notifications.filter((notification: any) => {
        return notification.id !== id;
      });
    });
  }
}

coreModule.controller('AlertNotificationsListCtrl', AlertNotificationsListCtrl);
