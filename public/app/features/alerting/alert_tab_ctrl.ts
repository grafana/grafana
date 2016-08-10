 ///<reference path="../../headers/common.d.ts" />

import _ from 'lodash';

import {
  QueryPartDef,
  QueryPart,
} from 'app/core/components/query_part/query_part';

var alertQueryDef = new QueryPartDef({
  type: 'query',
  params: [
    {name: "queryRefId", type: 'string', options: ['A', 'B', 'C', 'D', 'E', 'F']},
    {name: "from", type: "string", options: ['1s', '10s', '1m', '5m', '10m', '15m', '1h']},
    {name: "to", type: "string", options: ['now']},
  ],
  defaultParams: ['#A', '5m', 'now', 'avg']
});

var reducerAvgDef = new QueryPartDef({
  type: 'avg',
  params: [],
  defaultParams: []
});

export class AlertTabCtrl {
  panel: any;
  panelCtrl: any;
  testing: boolean;
  testResult: any;
  subTabIndex: number;

  handlers = [{text: 'Grafana', value: 1}, {text: 'External', value: 0}];
  conditionTypes = [
    {text: 'Query', value: 'query'},
  ];
  alert: any;
  conditionModels: any;
  evalFunctions = [
    {text: '>', value: '>'},
    {text: '<', value: '<'},
  ];
  severityLevels = [
    {text: 'Critical', value: 'critical'},
    {text: 'Warning', value: 'warning'},
  ];
  addNotificationSegment;
  notifications;
  alertNotifications;

  /** @ngInject */
  constructor(private $scope, private $timeout, private backendSrv, private dashboardSrv, private uiSegmentSrv) {
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    this.$scope.ctrl = this;
    this.subTabIndex = 0;
  }

  $onInit() {
    this.addNotificationSegment = this.uiSegmentSrv.newPlusButton();

    this.initModel();

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

    return this.backendSrv.get('/api/alert-notifications').then(res => {
      this.notifications = res;

      _.each(this.alert.notifications, item => {
        var model = _.findWhere(this.notifications, {id: item.id});
        if (model) {
          model.iconClass = this.getNotificationIcon(model.type);
          this.alertNotifications.push(model);
        }
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
    alert.description = alert.description || defaultName;

    this.conditionModels = _.reduce(alert.conditions, (memo, value) => {
      memo.push(this.buildConditionModel(value));
      return memo;
    }, []);

    if (this.alert.enabled) {
      this.panelCtrl.editingThresholds = true;
    }

    this.syncThresholds();
    this.panelCtrl.render();
  }

  syncThresholds() {
    if (this.panel.type !== 'graph') {
      return;
    }

    var threshold: any = {};
    if (this.panel.thresholds && this.panel.thresholds.length > 0) {
      threshold = this.panel.thresholds[0];
    } else {
      this.panel.thresholds = [threshold];
    }

    var updated = false;
    for (var condition of this.conditionModels) {
      if (condition.type === 'query') {
        var value = condition.evaluator.params[0];
        if (!_.isNumber(value)) {
          continue;
        }

        if (value !== threshold.value) {
          threshold.value = value;
          updated = true;
        }

        if (condition.evaluator.type !== threshold.op) {
          threshold.op = condition.evaluator.type;
          updated = true;
        }
      }
    }

    return updated;
  }

  graphThresholdChanged(evt) {
    for (var condition of this.alert.conditions) {
      if (condition.type === 'query') {
        condition.evaluator.params[0] = evt.threshold.value;
        break;
      }
    }
  }

  buildDefaultCondition() {
    return {
      type: 'query',
      query: {params: ['A', '5m', 'now']},
      reducer: {type: 'avg', params: []},
      evaluator: {type: '>', params: [null]},
    };
  }

  buildConditionModel(source) {
    var cm: any = {source: source, type: source.type};

    cm.queryPart = new QueryPart(source.query, alertQueryDef);
    cm.reducerPart = new QueryPart({params: []}, reducerAvgDef);
    cm.evaluator = source.evaluator;

    return cm;
  }

  queryPartUpdated(conditionModel) {
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
    this.alert.enabled = false;
    this.initModel();
  }

  enable() {
    this.alert.enabled = true;
    this.initModel();
  }

  thresholdUpdated() {
    if (this.syncThresholds()) {
      this.panelCtrl.render();
    }
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
