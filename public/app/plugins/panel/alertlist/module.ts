///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import moment from 'moment';
import alertDef from '../../../features/alerting/alert_def';
import config from 'app/core/config';
import {PanelCtrl} from 'app/plugins/sdk';

import * as rangeUtil from 'app/core/utils/rangeutil';
import * as dateMath from 'app/core/utils/datemath';

class AlertListPanel extends PanelCtrl {
  static templateUrl = 'module.html';

  showOptions = [
    {text: 'Current state', value: 'current'},
    {text: 'Recent state changes', value: 'changes'}
  ];

  sortOrderOptions = [
    {text: 'Alphabetical (asc)', value: 1},
    {text: 'Alphabetical (desc)', value: 2},
    {text: 'Importance', value: 3},
  ];

  contentHeight: string;
  stateFilter: any = {};
  currentAlerts: any = [];
  alertHistory: any = [];
  // Set and populate defaults
  panelDefaults = {
    show: 'current',
    limit: 10,
    stateFilter: [],
    onlyAlertsOnDashboard: false,
    sortOrder: 1
  };

  /** @ngInject */
  constructor($scope, $injector, private $location, private backendSrv, private timeSrv, private templateSrv) {
    super($scope, $injector);
    _.defaults(this.panel, this.panelDefaults);

    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('render',  this.onRender.bind(this));
    this.events.on('refresh', this.onRender.bind(this));

    for (let key in this.panel.stateFilter) {
      this.stateFilter[this.panel.stateFilter[key]] = true;
    }
  }

  sortResult(alerts) {
    if (this.panel.sortOrder === 3) {
      return _.sortBy(alerts, a => { return alertDef.alertStateSortScore[a.state]; });
    }

    var result = _.sortBy(alerts, a => { return a.name.toLowerCase();});
    if (this.panel.sortOrder === 2) {
      result.reverse();
    }

    return result;
  }

  updateStateFilter() {
    var result = [];

    for (let key in this.stateFilter) {
      if (this.stateFilter[key]) {
        result.push(key);
      }
    }

    this.panel.stateFilter = result;
    this.onRender();
  }

  onRender() {
    this.contentHeight = "max-height: " + this.height + "px;";
    if (this.panel.show === 'current') {
      this.getCurrentAlertState();
    }

    if (this.panel.show === 'changes') {
      this.getStateChanges();
    }
  }

  getStateChanges() {
    var params: any = {
      limit: this.panel.limit,
      type: 'alert',
      newState: this.panel.stateFilter,
    };

    if (this.panel.onlyAlertsOnDashboard) {
      params.dashboardId = this.dashboard.id;
    }

    params.from = dateMath.parse(this.dashboard.time.from).unix() * 1000;
    params.to = dateMath.parse(this.dashboard.time.to).unix() * 1000;

    this.backendSrv.get(`/api/annotations`, params)
      .then(res => {
        this.alertHistory = _.map(res, al => {
          al.time = this.dashboard.formatDate(al.time, 'MMM D, YYYY HH:mm:ss');
          al.stateModel = alertDef.getStateDisplayModel(al.newState);
          al.info = alertDef.getAlertAnnotationInfo(al);
          return al;
        });
      });
  }

  getCurrentAlertState() {
    var params: any = {
      state: this.panel.stateFilter
    };

    if (this.panel.onlyAlertsOnDashboard) {
      params.dashboardId = this.dashboard.id;
    }

    this.backendSrv.get(`/api/alerts`, params)
      .then(res => {
        this.currentAlerts = this.sortResult(_.map(res, al => {
          al.stateModel = alertDef.getStateDisplayModel(al.state);
          al.newStateDateAgo = moment(al.newStateDate).locale('en').fromNow(true);
          return al;
        }));
      });
  }

  onInitEditMode() {
    this.addEditorTab('Options', 'public/app/plugins/panel/alertlist/editor.html');
  }
}

export {
  AlertListPanel,
  AlertListPanel as PanelCtrl
};
