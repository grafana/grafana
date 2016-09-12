///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import moment from 'moment';
import alertDef from '../../../features/alerting/alert_def';
import config from 'app/core/config';
import {PanelCtrl} from 'app/plugins/sdk';

class AlertListPanel extends PanelCtrl {
  static templateUrl = 'module.html';

  showOptions = [
    {text: 'Current state', value: 'current'},
    {text: 'State changes', value: 'changes'},
  ];

  currentAlerts: any = [];
  alertHistory: any = [];
  // Set and populate defaults
  panelDefaults = {
    show: 'current'
  };

  /** @ngInject */
  constructor($scope, $injector, private $location, private backendSrv) {
    super($scope, $injector);
    _.defaults(this.panel, this.panelDefaults);

    this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
    this.events.on('render',  this.onRender.bind(this));
    this.events.on('refresh', this.onRender.bind(this));
  }

  onRender() {
    if (this.panel.show === 'current') {
      this.getCurrentAlertState();
    }

    if (this.panel.show === 'changes') {
      this.getAlertHistory();
    }
  }

  getAlertHistory() {
    this.backendSrv.get(`/api/alert-history?dashboardId=32&panelId=1`)
      .then(res => {
        this.alertHistory = _.map(res, al => {
          al.time = moment(al.timestamp).format('MMM D, YYYY HH:mm:ss');
          al.stateModel = alertDef.getStateDisplayModel(al.newState);
          return al;
        });
      });
  }

  getCurrentAlertState() {
    this.backendSrv.get(`/api/alerts`)
      .then(res => {
        this.currentAlerts = _.map(res, al => {
          al.stateModel = alertDef.getStateDisplayModel(al.state);
          al.newStateDateAgo = moment(al.newStateDate).fromNow().replace(" ago", "");

          return al;
        });
      });
  }

  onInitEditMode() {
    this.addEditorTab('Options', 'public/app/plugins/panel/alertlist/editor.html');
  }
}

export {
  AlertListPanel,
  AlertListPanel as PanelCtrl
}
