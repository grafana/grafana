///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from 'app/core/core_module';

class DashboardScriptLoader {
}

export class DashImportListCtrl {
  dashboards: any[];
  plugin: any;

  constructor(private $http, private backendSrv, private $rootScope) {
    this.dashboards = [];

    backendSrv.get(`/api/plugins/dashboards/${this.plugin.id}`).then(dashboards => {
      this.dashboards = dashboards;
    });
  }

  import(dash) {
    var installCmd = {
      pluginId: this.plugin.id,
      path: dash.path,
      inputs: {}
    };

    this.backendSrv.post(`/api/plugins/dashboards/install`, installCmd).then(res => {
      console.log(res);
    });
  }

}

var template = `
<div class="gf-form-group" ng-if="ctrl.dashboards.length">
  <table class="filter-table">
    <tbody>
      <tr ng-repeat="dash in ctrl.dashboards">
        <td class="width-1">
          <i class="icon-gf icon-gf-dashboard"></i>
        </td>
        <td>
          {{dash.title}}
        </td>
        <td>
          {{dash.revision}}
        </td>
        <td>
          {{dash.installedRevision}}
        </td>
        <td class="width-2">
          <button class="btn btn-secondary" ng-click="ctrl.import(dash)">Install</button>
        </td>
      </tr>
    </tbody>
  </table>
</div>
`;

export function dashboardImportList() {
  return {
    restrict: 'E',
    template: template,
    controller: DashImportListCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      plugin: "="
    }
  };
}


coreModule.directive('dashboardImportList', dashboardImportList);




