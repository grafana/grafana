///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from 'app/core/core_module';

export class DashImportListCtrl {
  dashboards: any[];
  plugin: any;
  datasource: any;

  constructor(private $http, private backendSrv, private $rootScope) {
    this.dashboards = [];

    backendSrv.get(`/api/plugins/${this.plugin.id}/dashboards`).then(dashboards => {
      this.dashboards = dashboards;
    });
  }

  import(dash, reinstall) {
    var installCmd = {
      pluginId: this.plugin.id,
      path: dash.path,
      reinstall: reinstall,
      inputs: []
    };

    if (this.datasource) {
      installCmd.inputs.push({
        name: '*',
        type: 'datasource',
        pluginId: this.datasource.type,
        value: this.datasource.name
      });
    }

    this.backendSrv.post(`/api/dashboards/import`, installCmd).then(res => {
      this.$rootScope.appEvent('alert-success', ['Dashboard Installed', dash.title]);
      _.extend(dash, res);
    });
  }

  remove(dash) {
    this.backendSrv.delete('/api/dashboards/' + dash.installedUri).then(() => {
      this.$rootScope.appEvent('alert-success', ['Dashboard Deleted', dash.title]);
      dash.installed = false;
    });
  }
}

export function dashboardImportList() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/plugins/import_list/import_list.html',
    controller: DashImportListCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      plugin: "=",
      datasource: "="
    }
  };
}

coreModule.directive('dashboardImportList', dashboardImportList);




