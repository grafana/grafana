import angular, { ILocationService } from 'angular';
import _ from 'lodash';
import { e2e } from '@grafana/e2e';

import { VariableSrv } from 'app/features/templating/all';
import { CoreEvents } from '../../../../types';
import { VariableModel } from '../../../templating/variable';
import { getVariable } from '../../../templating/state/selectors';
import { variableAdapters } from '../../../templating/adapters';
import { VariableMovedToState } from '../../../../types/events';

export class SubMenuCtrl {
  annotations: any;
  variables: VariableModel[];
  dashboard: any;
  submenuEnabled: boolean;
  selectors: typeof e2e.pages.Dashboard.SubMenu.selectors;

  /** @ngInject */
  constructor(private variableSrv: VariableSrv, private $location: ILocationService) {
    this.annotations = this.dashboard.templating.list;
    this.variables = this.variableSrv.variables;
    this.submenuEnabled = this.dashboard.meta.submenuEnabled;
    this.dashboard.events.on(CoreEvents.submenuVisibilityChanged, (enabled: boolean) => {
      this.submenuEnabled = enabled;
    });
    this.dashboard.events.on(CoreEvents.variableMovedToState, this.onVariableMovedToState.bind(this));
    this.selectors = e2e.pages.Dashboard.SubMenu.selectors;
  }

  annotationStateChanged() {
    this.dashboard.startRefresh();
  }

  variableUpdated(variable: VariableModel) {
    this.variableSrv.variableUpdated(variable, true);
  }

  hasAdapter(variable: VariableModel): boolean {
    return variableAdapters.contains(variable.type);
  }

  openEditView(editview: any) {
    const search = _.extend(this.$location.search(), { editview: editview });
    this.$location.search(search);
  }

  onVariableMovedToState(args: VariableMovedToState) {
    for (let index = 0; index < this.variables.length; index++) {
      const angularVariable = this.variables[index];
      if (angularVariable.index === args.index) {
        const variable = { ...getVariable(args.uuid) };
        this.variables[index] = variable;
        break;
      }
    }
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
