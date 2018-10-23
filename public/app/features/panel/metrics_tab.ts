// Libraries
import _ from 'lodash';
import Remarkable from 'remarkable';

// Services & utils
import coreModule from 'app/core/core_module';
import config from 'app/core/config';

// Types
import { DashboardModel } from '../dashboard/dashboard_model';

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
    this.panel.datasource = this.panel.datasource || null;
    this.panel.targets = this.panel.targets || [{}];

    this.dashboard = this.panelCtrl.dashboard;
    this.datasources = datasourceSrv.getMetricSources();
    this.panelDsValue = this.panelCtrl.panel.datasource;

    for (const ds of this.datasources) {
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
    this.setDatasource(option.datasource);
    this.updateDatasourceOptions();
  }

  setDatasource(datasource) {
    // switching to mixed
    if (datasource.meta.mixed) {
      _.each(this.panel.targets, target => {
        target.datasource = this.panel.datasource;
        if (!target.datasource) {
          target.datasource = config.defaultDatasource;
        }
      });
    } else if (this.datasourceInstance && this.datasourceInstance.meta.mixed) {
      _.each(this.panel.targets, target => {
        delete target.datasource;
      });
    }

    this.panel.datasource = datasource.value;
    this.panel.refresh();
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
      const md = new Remarkable();
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

/** @ngInject */
export function metricsTabDirective() {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/app/features/panel/partials/metrics_tab.html',
    controller: MetricsTabCtrl,
  };
}

coreModule.directive('metricsTab', metricsTabDirective);
