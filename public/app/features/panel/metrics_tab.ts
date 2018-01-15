import { DashboardModel } from '../dashboard/dashboard_model';
import Remarkable from 'remarkable';

export class MetricsTabCtrl {
  dsName: string;
  panel: any;
  panelCtrl: any;
  datasources: any[];
  datasourceInstance: any;
  nextRefId: string;
  dashboard: DashboardModel;
  panelDsValue: any;
  addQueryDropdown: any;
  queryTroubleshooterOpen: boolean;
  helpOpen: boolean;
  optionsOpen: boolean;
  hasQueryHelp: boolean;
  helpHtml: string;
  queryOptions: any;

  /** @ngInject */
  constructor($scope, private $sce, datasourceSrv, private backendSrv) {
    this.panelCtrl = $scope.ctrl;
    $scope.ctrl = this;

    this.panel = this.panelCtrl.panel;
    this.dashboard = this.panelCtrl.dashboard;
    this.datasources = datasourceSrv.getMetricSources();
    this.panelDsValue = this.panelCtrl.panel.datasource;

    for (let ds of this.datasources) {
      if (ds.value === this.panelDsValue) {
        this.datasourceInstance = ds;
      }
    }

    this.addQueryDropdown = { text: 'Add Query', value: null, fake: true };

    // update next ref id
    this.panelCtrl.nextRefId = this.dashboard.getNextQueryLetter(this.panel);
    this.updateDatasourceOptions();
  }

  updateDatasourceOptions() {
    if (this.datasourceInstance) {
      this.hasQueryHelp = this.datasourceInstance.meta.hasQueryHelp;
      this.queryOptions = this.datasourceInstance.meta.queryOptions;
    }
  }

  getOptions(includeBuiltin) {
    return Promise.resolve(
      this.datasources
        .filter(value => {
          return includeBuiltin || !value.meta.builtIn;
        })
        .map(ds => {
          return { value: ds.value, text: ds.name, datasource: ds };
        })
    );
  }

  datasourceChanged(option) {
    if (!option) {
      return;
    }

    this.datasourceInstance = option.datasource;
    this.panelCtrl.setDatasource(option.datasource);
    this.updateDatasourceOptions();
  }

  addMixedQuery(option) {
    if (!option) {
      return;
    }

    this.panelCtrl.addQuery({
      isNew: true,
      datasource: option.datasource.name,
    });
    this.addQueryDropdown = { text: 'Add Query', value: null, fake: true };
  }

  addQuery() {
    this.panelCtrl.addQuery({ isNew: true });
  }

  toggleHelp() {
    this.optionsOpen = false;
    this.queryTroubleshooterOpen = false;
    this.helpOpen = !this.helpOpen;

    this.backendSrv.get(`/api/plugins/${this.datasourceInstance.meta.id}/markdown/query_help`).then(res => {
      var md = new Remarkable();
      this.helpHtml = this.$sce.trustAsHtml(md.render(res));
    });
  }

  toggleOptions() {
    this.helpOpen = false;
    this.queryTroubleshooterOpen = false;
    this.optionsOpen = !this.optionsOpen;
  }

  toggleQueryTroubleshooter() {
    this.helpOpen = false;
    this.optionsOpen = false;
    this.queryTroubleshooterOpen = !this.queryTroubleshooterOpen;
  }
}

/** @ngInject **/
export function metricsTabDirective() {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/app/features/panel/partials/metrics_tab.html',
    controller: MetricsTabCtrl,
  };
}
