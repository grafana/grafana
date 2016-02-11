///<reference path="../../../headers/common.d.ts" />

import angular from 'angular';
import coreModule from 'app/core/core_module';

class DashboardScriptLoader {

}

export class DashImportListCtrl {
  constructor(private $http) {
    console.log('importList', this);
  }

  load(json) {
    var model = angular.fromJson(json);
    console.log(model);
  }

  import() {
    var url = 'public/app/plugins/datasource/graphite/dashboards/carbon_stats.json';
    this.$http.get(url).then(res => {
      this.load(res.data);
    });
  }
}

var template = `
<button class="btn btn-mini btn-inverse" ng-click="ctrl.import(dash)">Import</span>
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




