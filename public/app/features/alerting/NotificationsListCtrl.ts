import { IScope } from 'angular';
import { getBackendSrv } from '@grafana/runtime';

import { coreModule, NavModelSrv } from 'app/core/core';
import { promiseToDigest } from '../../core/utils/promiseToDigest';

export class AlertNotificationsListCtrl {
  notifications: any;
  navModel: any;

  /** @ngInject */
  constructor(private $scope: IScope, navModelSrv: NavModelSrv) {
    this.loadNotifications();
    this.navModel = navModelSrv.getNav('alerting', 'channels', 0);
  }

  loadNotifications() {
    promiseToDigest(this.$scope)(
      getBackendSrv()
        .get(`/api/alert-notifications`)
        .then((result: any) => {
          this.notifications = result;
        })
    );
  }

  deleteNotification(id: number) {
    promiseToDigest(this.$scope)(
      getBackendSrv()
        .delete(`/api/alert-notifications/${id}`)
        .then(() => {
          this.notifications = this.notifications.filter((notification: any) => {
            return notification.id !== id;
          });
        })
    );
  }
}

coreModule.controller('AlertNotificationsListCtrl', AlertNotificationsListCtrl);
