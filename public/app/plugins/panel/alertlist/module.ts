///<reference path="../../../headers/common.d.ts" />

import _ from 'lodash';
import moment from 'moment';
import alertDef from '../../../features/alerting/alert_def';
import config from 'app/core/config';
//import * as dateMath from 'app/core/utils/datemath';
import {PanelCtrl} from 'app/plugins/sdk';

class AlertListPanel extends PanelCtrl {
  static templateUrl = 'module.html';

  showOptions = [
    {text: 'Current state', value: 'current'},
    {text: 'Recent statechanges', value: 'changes'}
  ];

  alertStates = [ 'all', 'ok', 'alerting', 'paused', 'no_data', 'execution_error' ];

  currentAlerts: any = [];
  alertHistory: any = [];
  // Set and populate defaults
  panelDefaults = {
    show: 'current',
    limit: 10,
    stateFilter: 'all'
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
      this.getStateChanges();
    }
  }

  getStateChanges() {
    var params: any = {
      limit: this.panel.limit,
      type: 'alert',
    };

    if (this.panel.stateFilter !== "all") {
      params.newState = this.panel.stateFilter;
    }
    /*
    var since = this.panel.since;
    if (since !== undefined && since !== "" && since !== null) {
      var t = this.dashboard.time;
      var now = (new Date()).getTime();
      params.to = t.to;

      //this.range = this.timeSrv.timeRange();
      params.from = dateMath.parseDateMath("1m", t.from, false);
    }
    */
    this.backendSrv.get(`/api/annotations`, params)
      .then(res => {
        this.alertHistory = _.map(res, al => {
          al.time = moment(al.time).format('MMM D, YYYY HH:mm:ss');
          al.stateModel = alertDef.getStateDisplayModel(al.newState);
          al.metrics = alertDef.joinEvalMatches(al.data, ', ');
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
