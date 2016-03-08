///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import coreModule from 'app/core/core_module';

class DashboardScriptLoader {

}

export class DashImportListCtrl {
  dashboards: any[];
  plugin: any;

  constructor(private $http) {

    this.dashboards = this.plugin.includes.filter(val => val.type === 'dashboard');

  }

  load(json) {
    var model = angular.fromJson(json);
    console.log(model);
  }

  import() {
    // this.$http.get(url).then(res => {
    //   this.load(res.data);
    // });
  }
}

var template = `
<div class="gf-form-group" ng-if="ctrl.dashboards.length">
  <h3 class="page-heading">Dashboards</h3>
  <div class="gf-form" ng-repeat="dash in ctrl.dashboards">
    <label class="gf-form-label">
        <i class="icon-gf icon-gf-dashboard"></i>
    </label>
    <label class="gf-form-label width-20">{{dash.name}}</label>
    <button class="btn btn-inverse gf-form-btn" ng-click="ctrl.import(dash)">Import</button>
  </div>
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




