///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from '../../core/core_module';
import config from 'app/core/config';

export class AlertNotificationEditCtrl {

  notification: any;

  /** @ngInject */
  constructor(private $routeParams, private backendSrv, private $scope) {
    if ($routeParams.notificationId) {
      this.loadNotification($routeParams.notificationId);
    } else {
      this.notification = {
        settings: {
          sendCrit: true,
          sendWarn: true,
        }
      };
    }
  }

  loadNotification(notificationId) {
    this.backendSrv.get(`/api/alert-notifications/${notificationId}`).then(result => {
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
      this.backendSrv.put(`/api/alert-notifications/${this.notification.id}`, this.notification)
        .then(result => {
          this.notification = result;
          this.$scope.appEvent('alert-success', ['Notification created!', '']);
        }, () => {
          this.$scope.appEvent('alert-error', ['Unable to create notification.', '']);
        });
    } else {
      this.backendSrv.post(`/api/alert-notifications`, this.notification)
        .then(result => {
          this.notification = result;
          this.$scope.appEvent('alert-success', ['Notification updated!', '']);
        }, () => {
          this.$scope.appEvent('alert-error', ['Unable to update notification.', '']);
        });
    }
  }
}

coreModule.controller('AlertNotificationEditCtrl', AlertNotificationEditCtrl);

