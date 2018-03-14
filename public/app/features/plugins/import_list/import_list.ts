import _ from 'lodash';
import coreModule from 'app/core/core_module';
import appEvents from 'app/core/app_events';

export class DashImportListCtrl {
  dashboards: any[];
  plugin: any;
  datasource: any;

  /** @ngInject */
  constructor($scope, private backendSrv, private $rootScope) {
    this.dashboards = [];

    backendSrv.get(`/api/plugins/${this.plugin.id}/dashboards`).then(dashboards => {
      this.dashboards = dashboards;
    });

    appEvents.on('dashboard-list-import-all', this.importAll.bind(this), $scope);
  }

  importAll(payload) {
    return this.importNext(0)
      .then(() => {
        payload.resolve('All dashboards imported');
      })
      .catch(err => {
        payload.reject(err);
      });
  }

  importNext(index) {
    return this.import(this.dashboards[index], true).then(() => {
      if (index + 1 < this.dashboards.length) {
        return new Promise(resolve => {
          setTimeout(() => {
            this.importNext(index + 1).then(() => {
              resolve();
            });
          }, 500);
        });
      } else {
        return Promise.resolve();
      }
    });
  }

  import(dash, overwrite) {
    var installCmd = {
      pluginId: this.plugin.id,
      path: dash.path,
      overwrite: overwrite,
      inputs: [],
    };

    if (this.datasource) {
      installCmd.inputs.push({
        name: '*',
        type: 'datasource',
        pluginId: this.datasource.type,
        value: this.datasource.name,
      });
    }

    return this.backendSrv.post(`/api/dashboards/import`, installCmd).then(res => {
      this.$rootScope.appEvent('alert-success', ['Dashboard Imported', dash.title]);
      _.extend(dash, res);
    });
  }

  remove(dash) {
    this.backendSrv.delete('/api/dashboards/' + dash.importedUri).then(() => {
      this.$rootScope.appEvent('alert-success', ['Dashboard Deleted', dash.title]);
      dash.imported = false;
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
      plugin: '=',
      datasource: '=',
    },
  };
}

coreModule.directive('dashboardImportList', dashboardImportList);
