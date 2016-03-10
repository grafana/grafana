///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import _ from 'lodash';
import coreModule from 'app/core/core_module';

class DashboardScriptLoader {
}

export class DashImportListCtrl {
  dashboards: any[];
  plugin: any;

  constructor(private $http) {
    this.dashboards = [];

    this.plugin.includes
    .filter(val => val.type === 'dashboard')
    .forEach(this.getDashbordImportStatus.bind(this));
  }

  getDashbordImportStatus(dash) {
    var dashUrl = this.plugin.baseUrl + '/' + dash.path;
    this.$http.get(dashUrl).then(res => {
      this.load(res.data);

    });
  }

  load(json) {
    var model = angular.fromJson(json);
    console.log(model);
  }

  import(dash) {
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
          {{dash.name}}</span>
        </td>
        <td class="width-2">
          <button class="btn btn-secondary" ng-click="ctrl.import(dash)">Install</button>
        </td
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




