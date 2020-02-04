import angular, { ILocationService } from 'angular';
import _ from 'lodash';
import { e2e } from '@grafana/e2e';

import { VariableSrv } from 'app/features/templating/all';
import { CoreEvents } from '../../../../types';
import { VariableModel } from '../../../templating/variable';
import { getVariable, getVariables } from '../../../templating/state/selectors';
import { variableAdapters } from '../../../templating/adapters';
import { MoveVariableType, VariableMovedToState } from '../../../../types/events';

export class SubMenuCtrl {
  annotations: any;
  variables: VariableModel[];
  dashboard: any;
  submenuEnabled: boolean;
  selectors: typeof e2e.pages.Dashboard.SubMenu.selectors;

  /** @ngInject */
  constructor(private variableSrv: VariableSrv, private $location: ILocationService) {
    this.annotations = this.dashboard.templating.list;
    const variablesInState = getVariables().map(variable => ({ ...variable }));
    this.variables = this.variableSrv.variables.concat(variablesInState).sort((a, b) => a.index - b.index);
    this.submenuEnabled = this.dashboard.meta.submenuEnabled;
    this.dashboard.events.on(CoreEvents.submenuVisibilityChanged, (enabled: boolean) => {
      this.submenuEnabled = enabled;
    });
    this.dashboard.events.on(CoreEvents.variableMovedToState, this.onVariableMovedToState.bind(this));
    this.dashboard.events.on(
      CoreEvents.variableMovedToAngularSucceeded,
      this.onVariableMovedToAngularSucceeded.bind(this)
    );
    this.dashboard.on(
      CoreEvents.variableDuplicateVariableSucceeded,
      this.onVariableDuplicateVariableSucceeded.bind(this)
    );
    this.dashboard.on(
      CoreEvents.variableRemoveVariableInAngularSucceeded,
      this.onVariableRemoveVariableInAngularSucceeded.bind(this)
    );
    this.dashboard.on(CoreEvents.variableRemoveVariableSucceeded, this.onVariableRemoveVariableSucceeded.bind(this));

    this.selectors = e2e.pages.Dashboard.SubMenu.selectors;
  }

  annotationStateChanged() {
    this.dashboard.startRefresh();
  }

  variableUpdated(variable: VariableModel) {
    if (variableAdapters.contains(variable.type)) {
      return;
    }
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
      const variable = this.variables[index];
      if (variable.index === args.index) {
        const variable = { ...getVariable(args.uuid) };
        this.variables[index] = variable;
        break;
      }
    }
  }

  onVariableMovedToAngularSucceeded(args: MoveVariableType) {
    const variable = this.variableSrv.variables.find(v => v.index === args.index && v.name === args.name);
    for (let index = 0; index < this.variables.length; index++) {
      if (index === variable.index) {
        this.variables[index] = variable;
        break;
      }
    }
  }

  onVariableDuplicateVariableSucceeded(args: VariableMovedToState) {
    this.variables.push({ ...getVariable(args.uuid ?? '') });
  }

  onVariableRemoveVariableInAngularSucceeded(args: { name: string }) {
    this.variables = this.variables.filter(v => v.name !== args.name);
  }

  onVariableRemoveVariableSucceeded(args: { uuid: string }) {
    this.variables = this.variables.filter(v => v.uuid !== args.uuid);
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
