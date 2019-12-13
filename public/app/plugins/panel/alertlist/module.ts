import _ from 'lodash';
import alertDef from '../../../features/alerting/state/alertDef';
import { PanelCtrl } from 'app/plugins/sdk';

import { dateMath, dateTime } from '@grafana/data';
import { PanelEvents } from '@grafana/data';
import { auto, IScope } from 'angular';
import { getBackendSrv } from '@grafana/runtime';
import { promiseToDigest } from 'app/core/utils/promiseToDigest';

class AlertListPanel extends PanelCtrl {
  static templateUrl = 'module.html';
  static scrollable = true;

  showOptions = [
    { text: 'Current state', value: 'current' },
    { text: 'Recent state changes', value: 'changes' },
  ];

  sortOrderOptions = [
    { text: 'Alphabetical (asc)', value: 1 },
    { text: 'Alphabetical (desc)', value: 2 },
    { text: 'Importance', value: 3 },
  ];

  stateFilter: any = {};
  currentAlerts: any = [];
  alertHistory: any = [];
  noAlertsMessage: string;
  templateSrv: string;

  // Set and populate defaults
  panelDefaults: any = {
    show: 'current',
    limit: 10,
    stateFilter: [],
    onlyAlertsOnDashboard: false,
    sortOrder: 1,
    dashboardFilter: '',
    nameFilter: '',
    folderId: null,
  };

  /** @ngInject */
  constructor($scope: IScope, $injector: auto.IInjectorService) {
    super($scope, $injector);
    _.defaults(this.panel, this.panelDefaults);

    this.events.on(PanelEvents.editModeInitialized, this.onInitEditMode.bind(this));
    this.events.on(PanelEvents.refresh, this.onRefresh.bind(this));
    this.templateSrv = this.$injector.get('templateSrv');

    for (const key in this.panel.stateFilter) {
      this.stateFilter[this.panel.stateFilter[key]] = true;
    }
  }

  sortResult(alerts: any[]) {
    if (this.panel.sortOrder === 3) {
      return _.sortBy(alerts, a => {
        // @ts-ignore
        return alertDef.alertStateSortScore[a.state];
      });
    }

    const result = _.sortBy(alerts, a => {
      return a.name.toLowerCase();
    });
    if (this.panel.sortOrder === 2) {
      result.reverse();
    }

    return result;
  }

  updateStateFilter() {
    const result = [];

    for (const key in this.stateFilter) {
      if (this.stateFilter[key]) {
        result.push(key);
      }
    }

    this.panel.stateFilter = result;
    this.onRefresh();
  }

  onRefresh() {
    let getAlertsPromise;

    if (this.panel.show === 'current') {
      getAlertsPromise = this.getCurrentAlertState();
    }

    if (this.panel.show === 'changes') {
      getAlertsPromise = this.getStateChanges();
    }

    getAlertsPromise.then(() => {
      this.renderingCompleted();
    });
  }

  onFolderChange = (folder: any) => {
    this.panel.folderId = folder.id;
    this.refresh();
  };

  getStateChanges() {
    const params: any = {
      limit: this.panel.limit,
      type: 'alert',
      newState: this.panel.stateFilter,
    };

    if (this.panel.onlyAlertsOnDashboard) {
      params.dashboardId = this.dashboard.id;
    }

    params.from = dateMath.parse(this.dashboard.time.from).unix() * 1000;
    params.to = dateMath.parse(this.dashboard.time.to).unix() * 1000;

    return promiseToDigest(this.$scope)(
      getBackendSrv()
        .get(`/api/annotations`, params)
        .then(res => {
          this.alertHistory = _.map(res, al => {
            al.time = this.dashboard.formatDate(al.time, 'MMM D, YYYY HH:mm:ss');
            al.stateModel = alertDef.getStateDisplayModel(al.newState);
            al.info = alertDef.getAlertAnnotationInfo(al);
            return al;
          });

          this.noAlertsMessage = this.alertHistory.length === 0 ? 'No alerts in current time range' : '';

          return this.alertHistory;
        })
    );
  }

  getCurrentAlertState() {
    const params: any = {
      state: this.panel.stateFilter,
    };

    if (this.panel.nameFilter) {
      params.query = this.templateSrv.replace(this.panel.nameFilter, this.panel.scopedVars);
    }

    if (this.panel.folderId >= 0) {
      params.folderId = this.panel.folderId;
    }

    if (this.panel.dashboardFilter) {
      params.dashboardQuery = this.panel.dashboardFilter;
    }

    if (this.panel.onlyAlertsOnDashboard) {
      params.dashboardId = this.dashboard.id;
    }

    if (this.panel.dashboardTags) {
      params.dashboardTag = this.panel.dashboardTags;
    }

    return promiseToDigest(this.$scope)(
      getBackendSrv()
        .get(`/api/alerts`, params)
        .then(res => {
          this.currentAlerts = this.sortResult(
            _.map(res, al => {
              al.stateModel = alertDef.getStateDisplayModel(al.state);
              al.newStateDateAgo = dateTime(al.newStateDate)
                .locale('en')
                .fromNow(true);
              return al;
            })
          );
          if (this.currentAlerts.length > this.panel.limit) {
            this.currentAlerts = this.currentAlerts.slice(0, this.panel.limit);
          }
          this.noAlertsMessage = this.currentAlerts.length === 0 ? 'No alerts' : '';

          return this.currentAlerts;
        })
    );
  }

  onInitEditMode() {
    this.addEditorTab('Options', 'public/app/plugins/panel/alertlist/editor.html');
  }
}

export { AlertListPanel, AlertListPanel as PanelCtrl };
