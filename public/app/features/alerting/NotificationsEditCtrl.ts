import _ from 'lodash';
import { appEvents, coreModule, NavModelSrv } from 'app/core/core';
import { BackendSrv } from 'app/core/services/backend_srv';

export class AlertNotificationEditCtrl {
  theForm: any;
  navModel: any;
  testSeverity = 'critical';
  notifiers: any;
  notifierTemplateId: string;
  isNew: boolean;
  model: any;
  defaults: any = {
    type: 'email',
    sendReminder: false,
    disableResolveMessage: false,
    frequency: '15m',
    settings: {
      httpMethod: 'POST',
      autoResolve: true,
      uploadImage: true,
    },
    isDefault: false,
  };
  getFrequencySuggestion: any;

  /** @ngInject */
  constructor(
    private $routeParams: any,
    private backendSrv: BackendSrv,
    private $location: any,
    private $templateCache: any,
    navModelSrv: NavModelSrv
  ) {
    this.navModel = navModelSrv.getNav('alerting', 'channels', 0);
    this.isNew = !this.$routeParams.id;

    this.getFrequencySuggestion = () => {
      return ['1m', '5m', '10m', '15m', '30m', '1h'];
    };

    this.backendSrv
      .get(`/api/alert-notifiers`)
      .then((notifiers: any) => {
        this.notifiers = notifiers;

        // add option templates
        for (const notifier of this.notifiers) {
          this.$templateCache.put(this.getNotifierTemplateId(notifier.type), notifier.optionsTemplate);
        }

        if (!this.$routeParams.id) {
          this.navModel.breadcrumbs.push({ text: 'New channel' });
          this.navModel.node = { text: 'New channel' };
          return _.defaults(this.model, this.defaults);
        }

        return this.backendSrv.get(`/api/alert-notifications/${this.$routeParams.id}`).then((result: any) => {
          this.navModel.breadcrumbs.push({ text: result.name });
          this.navModel.node = { text: result.name };
          result.settings = _.defaults(result.settings, this.defaults.settings);
          return result;
        });
      })
      .then((model: any) => {
        this.model = model;
        this.notifierTemplateId = this.getNotifierTemplateId(this.model.type);
      });
  }

  save() {
    if (!this.theForm.$valid) {
      return;
    }

    if (this.model.id) {
      this.backendSrv
        .put(`/api/alert-notifications/${this.model.id}`, this.model)
        .then((res: any) => {
          this.model = res;
          appEvents.emit('alert-success', ['Notification updated', '']);
        })
        .catch((err: any) => {
          if (err.data && err.data.error) {
            appEvents.emit('alert-error', [err.data.error]);
          }
        });
    } else {
      this.backendSrv
        .post(`/api/alert-notifications`, this.model)
        .then((res: any) => {
          appEvents.emit('alert-success', ['Notification created', '']);
          this.$location.path('alerting/notifications');
        })
        .catch((err: any) => {
          if (err.data && err.data.error) {
            appEvents.emit('alert-error', [err.data.error]);
          }
        });
    }
  }

  getNotifierTemplateId(type: string) {
    return `notifier-options-${type}`;
  }

  typeChanged() {
    this.model.settings = _.defaults({}, this.defaults.settings);
    this.notifierTemplateId = this.getNotifierTemplateId(this.model.type);
  }

  testNotification() {
    if (!this.theForm.$valid) {
      return;
    }

    const payload = {
      name: this.model.name,
      type: this.model.type,
      frequency: this.model.frequency,
      settings: this.model.settings,
    };

    this.backendSrv.post(`/api/alert-notifications/test`, payload).then((res: any) => {
      appEvents.emit('alert-success', ['Test notification sent', '']);
    });
  }
}

coreModule.controller('AlertNotificationEditCtrl', AlertNotificationEditCtrl);
