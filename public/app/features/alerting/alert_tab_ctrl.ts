 ///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import {ThresholdMapper} from './threshold_mapper';
import {QueryPart} from 'app/core/components/query_part/query_part';
import alertDef from './alert_def';
import config from 'app/core/config';
import moment from 'moment';
import appEvents from 'app/core/app_events';

export class AlertTabCtrl {
  panel: any;
  panelCtrl: any;
  testing: boolean;
  testResult: any;
  subTabIndex: number;
  conditionTypes: any;
  alert: any;
  conditionModels: any;
  evalFunctions: any;
  evalOperators: any;
  noDataModes: any;
  executionErrorModes: any;
  addNotificationSegment;
  notifications;
  alertNotifications;
  error: string;
  appSubUrl: string;
  alertHistory: any;

  /** @ngInject */
  constructor(private $scope,
              private $timeout,
              private backendSrv,
              private dashboardSrv,
              private uiSegmentSrv,
              private $q,
              private datasourceSrv,
              private templateSrv) {
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
  }

  $onInit() {
    this.addNotificationSegment = this.uiSegmentSrv.newPlusButton();

    // subscribe to graph threshold handle changes
    var thresholdChangedEventHandler = this.graphThresholdChanged.bind(this);
    this.panelCtrl.events.on('threshold-changed', thresholdChangedEventHandler);

    // set panel alert edit mode
    this.$scope.$on("$destroy", () => {
      this.panelCtrl.events.off("threshold-changed", thresholdChangedEventHandler);
      this.panelCtrl.editingThresholds = false;
      this.panelCtrl.render();
    });

    // build notification model
    this.notifications = [];
    this.alertNotifications = [];
    this.alertHistory = [];

    return this.backendSrv.get('/api/alert-notifications').then(res => {
      this.notifications = res;

      this.initModel();
      this.validateModel();
    });
  }

  getAlertHistory() {
    this.backendSrv.get(`/api/annotations?dashboardId=${this.panelCtrl.dashboard.id}&panelId=${this.panel.id}&limit=50`).then(res => {
      this.alertHistory = _.map(res, ah => {
        ah.time = this.dashboardSrv.getCurrent().formatDate(ah.time, 'MMM D, YYYY HH:mm:ss');
        ah.stateModel = alertDef.getStateDisplayModel(ah.newState);
        ah.info = alertDef.getAlertAnnotationInfo(ah);
        return ah;
      });
    });
  }

  getNotificationIcon(type) {
    switch (type) {
      case "email": return "fa fa-envelope";
      case "slack": return "fa fa-slack";
      case "victorops": return "fa fa-pagelines";
      case "webhook": return "fa fa-cubes";
      case "pagerduty": return "fa fa-bullhorn";
      case "opsgenie": return "fa fa-bell";
      case "hipchat": return "fa fa-mail-forward";
      case "pushover": return "fa fa-mobile";
    }
  }

  getNotifications() {
    return Promise.resolve(this.notifications.map(item => {
      return this.uiSegmentSrv.newSegment(item.name);
    }));
  }

  changeTabIndex(newTabIndex) {
    this.subTabIndex = newTabIndex;

    if (this.subTabIndex === 2) {
      this.getAlertHistory();
    }
  }

  notificationAdded() {
    var model = _.find(this.notifications, {name: this.addNotificationSegment.value});
    if (!model) {
      return;
    }

    this.alertNotifications.push({
      name: model.name,
      iconClass: this.getNotificationIcon(model.type),
      isDefault: false
    });
    this.alert.notifications.push({id: model.id});

    // reset plus button
    this.addNotificationSegment.value = this.uiSegmentSrv.newPlusButton().value;
    this.addNotificationSegment.html = this.uiSegmentSrv.newPlusButton().html;
  }

  removeNotification(index) {
    this.alert.notifications.splice(index, 1);
    this.alertNotifications.splice(index, 1);
  }

  initModel() {
    var alert = this.alert = this.panel.alert;
    if (!alert) {
      return;
    }

    alert.conditions = alert.conditions || [];
    if (alert.conditions.length === 0) {
      alert.conditions.push(this.buildDefaultCondition());
    }

    alert.noDataState = alert.noDataState || 'no_data';
    alert.executionErrorState = alert.executionErrorState || 'alerting';
    alert.frequency = alert.frequency || '60s';
    alert.handler = alert.handler || 1;
    alert.notifications = alert.notifications || [];

    var defaultName = this.panel.title + ' alert';
    alert.name = alert.name || defaultName;

    this.conditionModels = _.reduce(alert.conditions, (memo, value) => {
      memo.push(this.buildConditionModel(value));
      return memo;
    }, []);

    ThresholdMapper.alertToGraphThresholds(this.panel);

    for (let addedNotification of alert.notifications) {
      var model = _.find(this.notifications, {id: addedNotification.id});
      if (model && model.isDefault === false) {
        model.iconClass = this.getNotificationIcon(model.type);
        this.alertNotifications.push(model);
      }
    }

    for (let notification of this.notifications) {
      if (notification.isDefault) {
        notification.iconClass = this.getNotificationIcon(notification.type);
        notification.bgColor = "#00678b";
        this.alertNotifications.push(notification);
      }
    }

    this.panelCtrl.editingThresholds = true;
    this.panelCtrl.render();
  }

  graphThresholdChanged(evt) {
    for (var condition of this.alert.conditions) {
      if (condition.type === 'query') {
        condition.evaluator.params[evt.handleIndex] = evt.threshold.value;
        this.evaluatorParamsChanged();
        break;
      }
    }
  }

  buildDefaultCondition() {
    return {
      type: 'query',
      query: {params: ['A', '5m', 'now']},
      reducer: {type: 'avg', params: []},
      evaluator: {type: 'gt', params: [null]},
      operator: {type: 'and'},
    };
  }

  validateModel() {
    if (!this.alert) {
      return;
    }

    let firstTarget;
    var fixed = false;
    let foundTarget = null;

    for (var condition of this.alert.conditions) {
      if (condition.type !== 'query') {
        continue;
      }

      for (var target of this.panel.targets) {
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
          fixed = true;
        } else {
          this.error = "Could not find any metric queries";
        }
      }

      var datasourceName = foundTarget.datasource || this.panel.datasource;
      this.datasourceSrv.get(datasourceName).then(ds => {
        if (!ds.meta.alerting) {
          this.error = 'The datasource does not support alerting queries';
        } else if (ds.targetContainsTemplate(foundTarget)) {
          this.error = 'Template variables are not supported in alert queries';
        } else {
          this.error = '';
        }
      });
    }
  }

  buildConditionModel(source) {
    var cm: any = {source: source, type: source.type};

    cm.queryPart = new QueryPart(source.query, alertDef.alertQueryDef);
    cm.reducerPart = alertDef.createReducerPart(source.reducer);
    cm.evaluator = source.evaluator;
    cm.operator = source.operator;

    return cm;
  }

  handleQueryPartEvent(conditionModel, evt) {
    switch (evt.name) {
      case "action-remove-part": {
        break;
      }
      case "get-part-actions": {
        return this.$q.when([]);
      }
      case "part-param-changed": {
        this.validateModel();
      }
      case "get-param-options": {
        var result = this.panel.targets.map(target => {
          return this.uiSegmentSrv.newSegment({ value: target.refId });
        });

        return this.$q.when(result);
      }
    }
  }

  handleReducerPartEvent(conditionModel, evt) {
    switch (evt.name) {
      case "action": {
        conditionModel.source.reducer.type = evt.action.value;
        conditionModel.reducerPart = alertDef.createReducerPart(conditionModel.source.reducer);
        break;
      }
      case "get-part-actions": {
        var result = [];
        for (var type of alertDef.reducerTypes) {
          if (type.value !== conditionModel.source.reducer.type) {
            result.push(type);
          }
        }
        return this.$q.when(result);
      }
    }
  }

  addCondition(type) {
    var condition = this.buildDefaultCondition();
    // add to persited model
    this.alert.conditions.push(condition);
    // add to view model
    this.conditionModels.push(this.buildConditionModel(condition));
  }

  removeCondition(index) {
    this.alert.conditions.splice(index, 1);
    this.conditionModels.splice(index, 1);
  }

  delete() {
    appEvents.emit('confirm-modal', {
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
      }
    });
  }

  enable() {
    this.panel.alert = {};
    this.initModel();
  }

  evaluatorParamsChanged() {
    ThresholdMapper.alertToGraphThresholds(this.panel);
    this.panelCtrl.render();
  }

  evaluatorTypeChanged(evaluator) {
    // ensure params array is correct length
    switch (evaluator.type) {
      case "lt":
        case "gt": {
        evaluator.params = [evaluator.params[0]];
        break;
      }
      case "within_range":
        case "outside_range": {
        evaluator.params = [evaluator.params[0], evaluator.params[1]];
        break;
      }
      case "no_value": {
        evaluator.params = [];
      }
    }

    this.evaluatorParamsChanged();
  }

  clearHistory() {
    appEvents.emit('confirm-modal', {
      title: 'Delete Alert History',
      text: 'Are you sure you want to remove all history & annotations for this alert?',
      icon: 'fa-trash',
      yesText: 'Yes',
      onConfirm: () => {
        this.backendSrv.post('/api/annotations/mass-delete', {
          dashboardId: this.panelCtrl.dashboard.id,
          panelId: this.panel.id,
        }).then(res => {
          this.alertHistory = [];
          this.panelCtrl.refresh();
        });
      }
    });
  }

  test() {
    this.testing = true;

    var payload = {
      dashboard: this.dashboardSrv.getCurrent().getSaveModelClone(),
      panelId: this.panelCtrl.panel.id,
    };

    return this.backendSrv.post('/api/alerts/test', payload).then(res => {
      this.testResult = res;
      this.testing = false;
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
