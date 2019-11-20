import angular, { ILocationService } from 'angular';
import _ from 'lodash';
import { VariableSrv } from 'app/features/templating/all';

export class SubMenuCtrl {
  annotations: any;
  variables: any;
  dashboard: any;

  /** @ngInject */
  constructor(private variableSrv: VariableSrv, private $location: ILocationService) {
    this.annotations = this.dashboard.templating.list;
    this.variables = this.variableSrv.variables;
  }

  annotationStateChanged() {
    this.dashboard.startRefresh();
  }

  variableUpdated(variable: any) {
    this.variableSrv.variableUpdated(variable, true);
  }

  openEditView(editview: any) {
    const search = _.extend(this.$location.search(), { editview: editview });
    this.$location.search(search);
  }
}

export function submenuDirective() {
  return {
    restrict: 'E',
    templateUrl: 'public/app/features/dashboard/components/SubMenu/template.html',
    controller: SubMenuCtrl,
    bindToController: true,
    controllerAs: 'ctrl',
    scope: {
      dashboard: '=',
    },
  };
}

angular.module('grafana.directives').directive('dashboardSubmenu', submenuDirective);
