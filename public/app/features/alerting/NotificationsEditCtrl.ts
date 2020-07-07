import _ from 'lodash';
import { appEvents, coreModule, NavModelSrv } from 'app/core/core';
import { getBackendSrv } from '@grafana/runtime';
import { AppEvents } from '@grafana/data';
import { IScope } from 'angular';
import { promiseToDigest } from '../../core/utils/promiseToDigest';
import config from 'app/core/config';
import { CoreEvents } from 'app/types';

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
      severity: 'critical',
      uploadImage: true,
    },
    isDefault: false,
  };
  getFrequencySuggestion: any;
  rendererAvailable: boolean;

  /** @ngInject */
  constructor(
    private $scope: IScope,
    private $routeParams: any,
    private $location: any,
    private $templateCache: any,
    navModelSrv: NavModelSrv
  ) {
    this.navModel = navModelSrv.getNav('alerting', 'channels', 0);
    this.isNew = !this.$routeParams.id;

    this.getFrequencySuggestion = () => {
      return ['1m', '5m', '10m', '15m', '30m', '1h'];
    };

    this.defaults.settings.uploadImage = config.rendererAvailable;
    this.rendererAvailable = config.rendererAvailable;

    promiseToDigest(this.$scope)(
      getBackendSrv()
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

          return getBackendSrv()
            .get(`/api/alert-notifications/${this.$routeParams.id}`)
            .then((result: any) => {
              this.navModel.breadcrumbs.push({ text: result.name });
              this.navModel.node = { text: result.name };
              result.settings = _.defaults(result.settings, this.defaults.settings);
              return result;
            });
        })
        .then((model: any) => {
          this.model = model;
          this.notifierTemplateId = this.getNotifierTemplateId(this.model.type);
        })
    );
  }

  save() {
    if (!this.theForm.$valid) {
      return;
    }

    if (this.model.id) {
      promiseToDigest(this.$scope)(
        getBackendSrv()
          .put(`/api/alert-notifications/${this.model.id}`, this.model)
          .then((res: any) => {
            this.model = res;
            appEvents.emit(AppEvents.alertSuccess, ['Notification updated']);
          })
          .catch((err: any) => {
            if (err.data && err.data.error) {
              appEvents.emit(AppEvents.alertError, [err.data.error]);
            }
          })
      );
    } else {
      promiseToDigest(this.$scope)(
        getBackendSrv()
          .post(`/api/alert-notifications`, this.model)
          .then((res: any) => {
            appEvents.emit(AppEvents.alertSuccess, ['Notification created']);
            this.$location.path('alerting/notifications');
          })
          .catch((err: any) => {
            if (err.data && err.data.error) {
              appEvents.emit(AppEvents.alertError, [err.data.error]);
            }
          })
      );
    }
  }

  deleteNotification() {
    appEvents.emit(CoreEvents.showConfirmModal, {
      title: 'Delete',
      text: 'Do you want to delete this notification channel?',
      text2: `Deleting this notification channel will not delete from alerts any references to it`,
      icon: 'trash-alt',
      confirmText: 'Delete',
      yesText: 'Delete',
      onConfirm: () => {
        this.deleteNotificationConfirmed();
      },
    });
  }

  deleteNotificationConfirmed() {
    promiseToDigest(this.$scope)(
      getBackendSrv()
        .delete(`/api/alert-notifications/${this.model.id}`)
        .then((res: any) => {
          this.model = res;
          this.$location.path('alerting/notifications');
        })
    );
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

    promiseToDigest(this.$scope)(getBackendSrv().post(`/api/alert-notifications/test`, payload));
  }
}

coreModule.controller('AlertNotificationEditCtrl', AlertNotificationEditCtrl);
