import _ from 'lodash';
import coreModule from 'app/core/core_module';
import { ThresholdMapper } from './state/ThresholdMapper';
import { QueryPart } from 'app/core/components/query_part/query_part';
import alertDef from './state/alertDef';
import config from 'app/core/config';
import appEvents from 'app/core/app_events';
import { getBackendSrv } from '@grafana/runtime';
import { DashboardSrv } from '../dashboard/services/DashboardSrv';
import DatasourceSrv from '../plugins/datasource_srv';
import { DataQuery, DataSourceApi } from '@grafana/data';
import { PanelModel } from 'app/features/dashboard/state';
import { getDefaultCondition } from './getAlertingValidationMessage';
import { CoreEvents } from 'app/types';
import kbn from 'app/core/utils/kbn';
import { promiseToDigest } from 'app/core/utils/promiseToDigest';

export class AlertTabCtrl {
  panel: PanelModel;
  panelCtrl: any;
  subTabIndex: number;
  conditionTypes: any;
  alert: any;
  conditionModels: any;
  evalFunctions: any;
  evalOperators: any;
  noDataModes: any;
  executionErrorModes: any;
  addNotificationSegment: any;
  notifications: any;
  alertNotifications: any;
  error: string;
  appSubUrl: string;
  alertHistory: any;
  newAlertRuleTag: any;
  alertingMinIntervalSecs: number;
  alertingMinInterval: string;
  frequencyWarning: any;

  /** @ngInject */
  constructor(
    private $scope: any,
    private dashboardSrv: DashboardSrv,
    private uiSegmentSrv: any,
    private datasourceSrv: DatasourceSrv
  ) {
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    this.$scope.ctrl = this;
    this.subTabIndex = 0;
    this.evalFunctions = alertDef.evalFunctions;
    this.evalOperators = alertDef.evalOperators;
    this.conditionTypes = alertDef.conditionTypes;
    this.noDataModes = alertDef.noDataModes;
    this.executionErrorModes = alertDef.executionErrorModes;
    this.appSubUrl = config.appSubUrl;
    this.panelCtrl._enableAlert = this.enable;
    this.alertingMinIntervalSecs = config.alertingMinInterval;
    this.alertingMinInterval = kbn.secondsToHms(config.alertingMinInterval);
  }

  $onInit() {
    this.addNotificationSegment = this.uiSegmentSrv.newPlusButton();

    // subscribe to graph threshold handle changes
    const thresholdChangedEventHandler = this.graphThresholdChanged.bind(this);
    this.panelCtrl.events.on(CoreEvents.thresholdChanged, thresholdChangedEventHandler);

    // set panel alert edit mode
    this.$scope.$on('$destroy', () => {
      this.panelCtrl.events.off(CoreEvents.thresholdChanged, thresholdChangedEventHandler);
      this.panelCtrl.editingThresholds = false;
      this.panelCtrl.render();
    });

    // build notification model
    this.notifications = [];
    this.alertNotifications = [];
    this.alertHistory = [];

    return promiseToDigest(this.$scope)(
      getBackendSrv()
        .get('/api/alert-notifications/lookup')
        .then((res: any) => {
          this.notifications = res;

          this.initModel();
          this.validateModel();
        })
    );
  }

  getAlertHistory() {
    promiseToDigest(this.$scope)(
      getBackendSrv()
        .get(`/api/annotations?dashboardId=${this.panelCtrl.dashboard.id}&panelId=${this.panel.id}&limit=50&type=alert`)
        .then((res: any) => {
          this.alertHistory = _.map(res, ah => {
            ah.time = this.dashboardSrv.getCurrent().formatDate(ah.time, 'MMM D, YYYY HH:mm:ss');
            ah.stateModel = alertDef.getStateDisplayModel(ah.newState);
            ah.info = alertDef.getAlertAnnotationInfo(ah);
            return ah;
          });
        })
    );
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'email':
        return 'fa fa-envelope';
      case 'slack':
        return 'fa fa-slack';
      case 'victorops':
        return 'fa fa-pagelines';
      case 'webhook':
        return 'fa fa-cubes';
      case 'pagerduty':
        return 'fa fa-bullhorn';
      case 'opsgenie':
        return 'fa fa-bell';
      case 'hipchat':
        return 'fa fa-mail-forward';
      case 'pushover':
        return 'fa fa-mobile';
      case 'kafka':
        return 'fa fa-random';
      case 'teams':
        return 'fa fa-windows';
    }
    return 'fa fa-bell';
  }

  getNotifications() {
    return Promise.resolve(
      this.notifications.map((item: any) => {
        return this.uiSegmentSrv.newSegment(item.name);
      })
    );
  }

  notificationAdded() {
    const model: any = _.find(this.notifications, {
      name: this.addNotificationSegment.value,
    });
    if (!model) {
      return;
    }

    this.alertNotifications.push({
      name: model.name,
      iconClass: this.getNotificationIcon(model.type),
      isDefault: false,
      uid: model.uid,
    });

    // avoid duplicates using both id and uid to be backwards compatible.
    if (!_.find(this.alert.notifications, n => n.id === model.id || n.uid === model.uid)) {
      this.alert.notifications.push({ uid: model.uid });
    }

    // reset plus button
    this.addNotificationSegment.value = this.uiSegmentSrv.newPlusButton().value;
    this.addNotificationSegment.html = this.uiSegmentSrv.newPlusButton().html;
    this.addNotificationSegment.fake = true;
  }

  removeNotification(an: any) {
    // remove notifiers refeered to by id and uid to support notifiers added
    // before and after we added support for uid
    _.remove(this.alert.notifications, (n: any) => n.uid === an.uid || n.id === an.id);
    _.remove(this.alertNotifications, (n: any) => n.uid === an.uid || n.id === an.id);
  }

  addAlertRuleTag() {
    if (this.newAlertRuleTag.name) {
      this.alert.alertRuleTags[this.newAlertRuleTag.name] = this.newAlertRuleTag.value;
    }
    this.newAlertRuleTag.name = '';
    this.newAlertRuleTag.value = '';
  }

  removeAlertRuleTag(tagName: string) {
    delete this.alert.alertRuleTags[tagName];
  }

  initModel() {
    const alert = (this.alert = this.panel.alert);
    if (!alert) {
      return;
    }

    this.checkFrequency();

    alert.conditions = alert.conditions || [];
    if (alert.conditions.length === 0) {
      alert.conditions.push(getDefaultCondition());
    }

    alert.noDataState = alert.noDataState || config.alertingNoDataOrNullValues;
    alert.executionErrorState = alert.executionErrorState || config.alertingErrorOrTimeout;
    alert.frequency = alert.frequency || '1m';
    alert.handler = alert.handler || 1;
    alert.notifications = alert.notifications || [];
    alert.for = alert.for || '0m';
    alert.alertRuleTags = alert.alertRuleTags || {};

    const defaultName = this.panel.title + ' alert';
    alert.name = alert.name || defaultName;

    this.conditionModels = _.reduce(
      alert.conditions,
      (memo, value) => {
        memo.push(this.buildConditionModel(value));
        return memo;
      },
      []
    );

    ThresholdMapper.alertToGraphThresholds(this.panel);

    for (const addedNotification of alert.notifications) {
      // lookup notifier type by uid
      let model: any = _.find(this.notifications, { uid: addedNotification.uid });

      // fallback to using id if uid is missing
      if (!model) {
        model = _.find(this.notifications, { id: addedNotification.id });
      }

      if (model && model.isDefault === false) {
        model.iconClass = this.getNotificationIcon(model.type);
        this.alertNotifications.push(model);
      }
    }

    for (const notification of this.notifications) {
      if (notification.isDefault) {
        notification.iconClass = this.getNotificationIcon(notification.type);
        this.alertNotifications.push(notification);
      }
    }

    this.panelCtrl.editingThresholds = true;
    this.panelCtrl.render();
  }

  checkFrequency() {
    if (!this.alert.frequency) {
      return;
    }

    this.frequencyWarning = '';

    try {
      const frequencySecs = kbn.interval_to_seconds(this.alert.frequency);
      if (frequencySecs < this.alertingMinIntervalSecs) {
        this.frequencyWarning =
          'A minimum evaluation interval of ' +
          this.alertingMinInterval +
          ' have been configured in Grafana and will be used for this alert rule. ' +
          'Please contact the administrator to configure a lower interval.';
      }
    } catch (err) {
      this.frequencyWarning = err;
    }
  }

  graphThresholdChanged(evt: any) {
    for (const condition of this.alert.conditions) {
      if (condition.type === 'query') {
        condition.evaluator.params[evt.handleIndex] = evt.threshold.value;
        this.evaluatorParamsChanged();
        break;
      }
    }
  }

  validateModel() {
    if (!this.alert) {
      return;
    }

    let firstTarget;
    let foundTarget: DataQuery = null;

    const promises: Array<Promise<any>> = [];
    for (const condition of this.alert.conditions) {
      if (condition.type !== 'query') {
        continue;
      }

      for (const target of this.panel.targets) {
        if (!firstTarget) {
          firstTarget = target;
        }
        if (condition.query.params[0] === target.refId) {
          foundTarget = target;
          break;
        }
      }

      if (!foundTarget) {
        if (firstTarget) {
          condition.query.params[0] = firstTarget.refId;
          foundTarget = firstTarget;
        } else {
          this.error = 'Could not find any metric queries';
          return;
        }
      }

      const datasourceName = foundTarget.datasource || this.panel.datasource;
      promises.push(
        this.datasourceSrv.get(datasourceName).then(
          (foundTarget => (ds: DataSourceApi) => {
            if (!ds.meta.alerting) {
              return Promise.reject('The datasource does not support alerting queries');
            } else if (ds.targetContainsTemplate && ds.targetContainsTemplate(foundTarget)) {
              return Promise.reject('Template variables are not supported in alert queries');
            }
            return Promise.resolve();
          })(foundTarget)
        )
      );
    }
    Promise.all(promises).then(
      () => {
        this.error = '';
        this.$scope.$apply();
      },
      e => {
        this.error = e;
        this.$scope.$apply();
      }
    );
  }

  buildConditionModel(source: any) {
    const cm: any = { source: source, type: source.type };

    cm.queryPart = new QueryPart(source.query, alertDef.alertQueryDef);
    cm.reducerPart = alertDef.createReducerPart(source.reducer);
    cm.evaluator = source.evaluator;
    cm.operator = source.operator;

    return cm;
  }

  handleQueryPartEvent(conditionModel: any, evt: any) {
    switch (evt.name) {
      case 'action-remove-part': {
        break;
      }
      case 'get-part-actions': {
        return Promise.resolve([]);
      }
      case 'part-param-changed': {
        this.validateModel();
      }
      case 'get-param-options': {
        const result = this.panel.targets.map(target => {
          return this.uiSegmentSrv.newSegment({ value: target.refId });
        });

        return Promise.resolve(result);
      }
      default: {
        return Promise.resolve();
      }
    }

    return Promise.resolve();
  }

  handleReducerPartEvent(conditionModel: any, evt: any) {
    switch (evt.name) {
      case 'action': {
        conditionModel.source.reducer.type = evt.action.value;
        conditionModel.reducerPart = alertDef.createReducerPart(conditionModel.source.reducer);
        break;
      }
      case 'get-part-actions': {
        const result = [];
        for (const type of alertDef.reducerTypes) {
          if (type.value !== conditionModel.source.reducer.type) {
            result.push(type);
          }
        }
        return Promise.resolve(result);
      }
    }

    return Promise.resolve();
  }

  addCondition(type: string) {
    const condition = getDefaultCondition();
    // add to persited model
    this.alert.conditions.push(condition);
    // add to view model
    this.conditionModels.push(this.buildConditionModel(condition));
  }

  removeCondition(index: number) {
    this.alert.conditions.splice(index, 1);
    this.conditionModels.splice(index, 1);
  }

  delete() {
    appEvents.emit(CoreEvents.showConfirmModal, {
      title: 'Delete Alert',
      text: 'Are you sure you want to delete this alert rule?',
      text2: 'You need to save dashboard for the delete to take effect',
      icon: 'fa-trash',
      yesText: 'Delete',
      onConfirm: () => {
        delete this.panel.alert;
        this.alert = null;
        this.panel.thresholds = [];
        this.conditionModels = [];
        this.panelCtrl.alertState = null;
        this.panelCtrl.render();
      },
    });
  }

  enable = () => {
    this.panel.alert = {};
    this.initModel();
    this.panel.alert.for = '5m'; //default value for new alerts. for existing alerts we use 0m to avoid breaking changes
  };

  evaluatorParamsChanged() {
    ThresholdMapper.alertToGraphThresholds(this.panel);
    this.panelCtrl.render();
  }

  evaluatorTypeChanged(evaluator: any) {
    // ensure params array is correct length
    switch (evaluator.type) {
      case 'lt':
      case 'gt': {
        evaluator.params = [evaluator.params[0]];
        break;
      }
      case 'within_range':
      case 'outside_range': {
        evaluator.params = [evaluator.params[0], evaluator.params[1]];
        break;
      }
      case 'no_value': {
        evaluator.params = [];
      }
    }

    this.evaluatorParamsChanged();
  }

  clearHistory() {
    appEvents.emit(CoreEvents.showConfirmModal, {
      title: 'Delete Alert History',
      text: 'Are you sure you want to remove all history & annotations for this alert?',
      icon: 'fa-trash',
      yesText: 'Yes',
      onConfirm: () => {
        promiseToDigest(this.$scope)(
          getBackendSrv()
            .post('/api/annotations/mass-delete', {
              dashboardId: this.panelCtrl.dashboard.id,
              panelId: this.panel.id,
            })
            .then(() => {
              this.alertHistory = [];
              this.panelCtrl.refresh();
            })
        );
      },
    });
  }
}

/** @ngInject */
export function alertTab() {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/app/features/alerting/partials/alert_tab.html',
    controller: AlertTabCtrl,
  };
}

coreModule.directive('alertTab', alertTab);
