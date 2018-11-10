import angular from 'angular';
import _ from 'lodash';

export class SubmenuCtrl {
  annotations: any;
  variables: any;
  dashboard: any;

  /** @ngInject */
  constructor(private variableSrv, private $location) {
    this.annotations = this.dashboard.templating.list;
    this.variables = this.variableSrv.variables;
  }

  annotationStateChanged() {
    this.dashboard.startRefresh();
  }

  variableUpdated(variable) {
    this.variableSrv.variableUpdated(variable, true);
  }

  openEditView(editview) {
    const search = _.extend(this.$location.search(), { editview: editview });
    this.$location.search(search);
  }
}

export function submenuDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/submenu/submenu.html',
    controller: SubmenuCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: '=',
    },
  };
}

angular.module('grafana.directives').directive('dashboardSubmenu', submenuDirective);
