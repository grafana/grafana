import { debounce, isEqual } from 'lodash';

import {
  formatRegistry,
  isCustomVariableValue,
  MultiValueVariable,
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { VariableFormatID } from '@grafana/schema';
import { appEvents } from 'app/core/core';
import { getClosestScopesFacade, ScopesFacade } from 'app/features/scopes';
import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';
import { ReloadDashboardEvent } from 'app/types/events';

export interface DashboardReloadBehaviorState extends SceneObjectState {
  reloadOnParamsChange?: boolean;
  uid?: string;
}

export class DashboardReloadBehavior extends SceneObjectBase {
  private _scopesFacade: ScopesFacade | null = null;

  constructor({ reloadOnParamsChange, uid }: DashboardReloadBehaviorState) {
    const shouldReload = reloadOnParamsChange && uid;

    super({});

    this.reloadDashboard = debounce(this.reloadDashboard.bind(this), 1000);

    if (shouldReload) {
      this.addActivationHandler(() => {
        this._scopesFacade = getClosestScopesFacade(this);

        this._variableDependency = new VariableDependencyConfig(this, {
          onAnyVariableChanged: this.reloadDashboard,
        });

        this._scopesFacade?.setState({
          handler: this.reloadDashboard,
        });

        this._subs.add(
          sceneGraph.getTimeRange(this).subscribeToState((newState, prevState) => {
            if (!isEqual(newState.value, prevState.value)) {
              this.reloadDashboard();
            }
          })
        );
      });
    }
  }

  private isEditing() {
    return this.parent && 'isEditing' in this.parent.state && this.parent.state.isEditing;
  }

  private reloadDashboard() {
    if (!this.isEditing()) {
      const timeRange = sceneGraph.getTimeRange(this);

      const format = formatRegistry.get(VariableFormatID.QueryParam);

      const timeParams = [
        `from=${timeRange.state.value.from.toISOString()}`,
        `to=${timeRange.state.value.to.toISOString()}`,
      ];

      if (timeRange.state.timeZone) {
        timeParams.push(`timeZone=${timeRange.state.timeZone}`);
      }

      const variablesParams = sceneGraph.getVariables(this).state.variables.reduce<string[]>((acc, variable) => {
        console.log(variable.state.name, 1);
        if (variable instanceof MultiValueVariable && variable.hasAllValue() && !variable.state.allValue) {
          acc.push(format.formatter(ALL_VARIABLE_VALUE, [], variable));
          return acc;
        }

        const value = variable.getValue();

        if (!value || (Array.isArray(value) && value.length === 0)) {
          return acc;
        }

        if (isCustomVariableValue(value)) {
          acc.push(value.formatter(VariableFormatID.QueryParam));
        } else {
          acc.push(format.formatter(value, [], variable));
        }

        return acc;
      }, []);

      const scopesParams = this._scopesFacade?.value.map((scope) => `scopes=${scope.metadata.name}`) ?? [];

      appEvents.publish(new ReloadDashboardEvent([...timeParams, ...variablesParams, ...scopesParams].join('&')));
    }
  }
}
