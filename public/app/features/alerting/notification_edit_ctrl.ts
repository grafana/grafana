///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from '../../core/core_module';
import config from 'app/core/config';

export class AlertNotificationEditCtrl {

  notification: any;

  /** @ngInject */
  constructor(private $routeParams, private backendSrv) {
    if ($routeParams.notificationId) {
      this.loadNotification($routeParams.notificationId);
    }
  }

  loadNotification(notificationId) {
    this.backendSrv.get(`/api/alerts/notification/${notificationId}`).then(result => {
      console.log(result);
      this.notification = result;
    });
  }

  isNew() {
    return this.notification === undefined || this.notification.id === undefined;
  }

  save() {
    if (this.notification.id) {
      console.log('this.notification: ', this.notification);
      this.backendSrv.put(`/api/alerts/notification/${this.notification.id}`, this.notification)
        .then(result => {
          this.notification = result;
          console.log('updated notification', result);
        });
    } else {
      this.backendSrv.post(`/api/alerts/notification`, this.notification)
        .then(result => {
          this.notification = result;
          console.log('created new notification', result);
        });
    }
  }
}

coreModule.controller('AlertNotificationEditCtrl', AlertNotificationEditCtrl);

