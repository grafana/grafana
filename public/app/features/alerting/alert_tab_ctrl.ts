 ///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';
import {ThresholdMapper} from './threshold_mapper';
import {QueryPart} from 'app/core/components/query_part/query_part';
import alertDef from './alert_def';
import config from 'app/core/config';
import moment from 'moment';

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
  severityLevels: any;
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
    this.conditionTypes = alertDef.conditionTypes;
    this.severityLevels = alertDef.severityLevels;
    this.appSubUrl = config.appSubUrl;
  }

  $onInit() {
    this.addNotificationSegment = this.uiSegmentSrv.newPlusButton();

    this.initModel();
    this.validateModel();

    // set panel alert edit mode
    this.$scope.$on("$destroy", () => {
      this.panelCtrl.editingThresholds = false;
      this.panelCtrl.render();
    });

    // subscribe to graph threshold handle changes
    this.panelCtrl.events.on('threshold-changed', this.graphThresholdChanged.bind(this));

    // build notification model
    this.notifications = [];
    this.alertNotifications = [];
    this.alertHistory = [];

    return this.backendSrv.get('/api/alert-notifications').then(res => {
      this.notifications = res;

      _.each(this.alert.notifications, item => {
        var model = _.findWhere(this.notifications, {id: item.id});
        if (model) {
          model.iconClass = this.getNotificationIcon(model.type);
          this.alertNotifications.push(model);
        }
      });
    }).then(() => {
      this.backendSrv.get(`/api/alert-history?dashboardId=${this.panelCtrl.dashboard.id}&panelId=${this.panel.id}`).then(res => {
        this.alertHistory = _.map(res, (ah) => {
          ah.time = moment(ah.timestamp).format('MMM D, YYYY HH:mm:ss');
          ah.stateModel = alertDef.getStateDisplayModel(ah.newState);

          ah.metrics = _.map(ah.data, (ev) => {
            return ev.Metric + "=" + ev.Value;
          }).join(', ');

          return ah;
        });
      });
    });
  }

  getNotificationIcon(type) {
    switch (type) {
      case "email": return "fa fa-envelope";
      case "slack": return "fa fa-slack";
      case "webhook": return "fa fa-cubes";
    }
  }

  getNotifications() {
    return Promise.resolve(this.notifications.map(item => {
      return this.uiSegmentSrv.newSegment(item.name);
    }));
  }


  notificationAdded() {
    var model = _.findWhere(this.notifications, {name: this.addNotificationSegment.value});
    if (!model) {
      return;
    }

    this.alertNotifications.push({name: model.name, iconClass: this.getNotificationIcon(model.type)});
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
    var alert = this.alert = this.panel.alert = this.panel.alert || {};

    alert.conditions = alert.conditions || [];
    if (alert.conditions.length === 0) {
      alert.conditions.push(this.buildDefaultCondition());
    }

    alert.severity = alert.severity || 'critical';
    alert.frequency = alert.frequency || '60s';
    alert.handler = alert.handler || 1;
    alert.notifications = alert.notifications || [];

    var defaultName = this.panel.title + ' alert';
    alert.name = alert.name || defaultName;

    this.conditionModels = _.reduce(alert.conditions, (memo, value) => {
      memo.push(this.buildConditionModel(value));
      return memo;
    }, []);

    if (this.alert.enabled) {
      this.panelCtrl.editingThresholds = true;
    }

    ThresholdMapper.alertToGraphThresholds(this.panel);
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
    };
  }

  validateModel() {
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
        if (ds.meta.id !== 'graphite') {
          this.error = 'Currently the alerting backend only supports Graphite queries';
        } else if (this.templateSrv.variableExists(foundTarget.target)) {
          this.error = 'Template variables are not supported in alert queries';
        }
      });
    }
  }

  buildConditionModel(source) {
    var cm: any = {source: source, type: source.type};

    cm.queryPart = new QueryPart(source.query, alertDef.alertQueryDef);
    cm.reducerPart = alertDef.createReducerPart(source.reducer);
    cm.evaluator = source.evaluator;

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
    this.alert = this.panel.alert = {enabled: false};
    this.panel.thresholds = [];
    this.conditionModels = [];
    this.panelCtrl.render();
  }

  enable() {
    this.alert.enabled = true;
    this.initModel();
  }

  evaluatorParamsChanged() {
    ThresholdMapper.alertToGraphThresholds(this.panel);
    this.panelCtrl.render();
  }

  severityChanged() {
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
