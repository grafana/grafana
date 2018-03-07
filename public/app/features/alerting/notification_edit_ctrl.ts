///<reference path="../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import config from 'app/core/config';
import {appEvents, coreModule} from 'app/core/core';

export class AlertNotificationEditCtrl {
  theForm: any;
  navModel: any;
  testSeverity = "critical";
  notifiers: any;
  notifierTemplateId: string;

  model: any;
  defaults: any = {
    type: 'email',
    settings: {
      httpMethod: 'POST',
      autoResolve: true,
      uploadImage: true,
    },
    isDefault: false
  };

  /** @ngInject */
  constructor(private $routeParams, private backendSrv, private $location, private $templateCache, navModelSrv) {
    this.navModel = navModelSrv.getAlertingNav();

    this.backendSrv.get(`/api/alert-notifiers`).then(notifiers => {
      this.notifiers = notifiers;

      // add option templates
      for (let notifier of this.notifiers) {
        this.$templateCache.put(this.getNotifierTemplateId(notifier.type), notifier.optionsTemplate);
      }

      if (!this.$routeParams.id) {
        return _.defaults(this.model, this.defaults);
      }

      return this.backendSrv.get(`/api/alert-notifications/${this.$routeParams.id}`).then(result => {
        return result;
      });
    }).then(model => {
      this.model = model;
      this.notifierTemplateId = this.getNotifierTemplateId(this.model.type);
    });
  }

  save() {
    if (!this.theForm.$valid) {
      return;
    }

    if (this.model.id) {
      this.backendSrv.put(`/api/alert-notifications/${this.model.id}`, this.model).then(res => {
        this.model = res;
        appEvents.emit('alert-success', ['Notification updated', '']);
      });
    } else {
      this.backendSrv.post(`/api/alert-notifications`, this.model).then(res => {
        appEvents.emit('alert-success', ['Notification created', '']);
        this.$location.path('alerting/notifications');
      });
    }
  }

  getNotifierTemplateId(type) {
    return `notifier-options-${type}`;
  }

  typeChanged() {
    this.model.settings = {};
    this.notifierTemplateId = this.getNotifierTemplateId(this.model.type);
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
      appEvents.emit('alert-success', ['Test notification sent', '']);
    });
  }
}

coreModule.controller('AlertNotificationEditCtrl', AlertNotificationEditCtrl);

