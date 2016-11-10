///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from '../../core/core_module';
import config from 'app/core/config';

export class AlertNotificationEditCtrl {
  model: any;
  theForm: any;
  testSeverity: string = "critical";

  /** @ngInject */
  constructor(private $routeParams, private backendSrv, private $scope, private $location) {
    if ($routeParams.id) {
      this.loadNotification($routeParams.id);
    } else {
      this.model = {
        type: 'email',
        settings: {
          httpMethod: 'POST',
          autoResolve: true,
        },
        isDefault: false
      };
    }
  }

  loadNotification(id) {
    this.backendSrv.get(`/api/alert-notifications/${id}`).then(result => {
      this.model = result;
    });
  }

  isNew() {
    return this.model.id === undefined;
  }

  save() {
    if (!this.theForm.$valid) {
      return;
    }

    if (this.model.id) {
      this.backendSrv.put(`/api/alert-notifications/${this.model.id}`, this.model).then(res => {
        this.model = res;
        this.$scope.appEvent('alert-success', ['Notification updated', '']);
      });
    } else {
      this.backendSrv.post(`/api/alert-notifications`, this.model).then(res => {
        this.$scope.appEvent('alert-success', ['Notification created', '']);
        this.$location.path('alerting/notifications');
      });
    }
  }

  typeChanged() {
    this.model.settings = {};
  }

  testNotification() {
    if (!this.theForm.$valid) {
      return;
    }

    var payload = {
      name: this.model.name,
      type: this.model.type,
      settings: this.model.settings,
    };

    this.backendSrv.post(`/api/alert-notifications/test`, payload)
      .then(res => {
        this.$scope.appEvent('alert-succes', ['Test notification sent', '']);
      });
  }
}

coreModule.controller('AlertNotificationEditCtrl', AlertNotificationEditCtrl);

