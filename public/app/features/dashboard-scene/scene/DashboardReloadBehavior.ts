import { debounce, isEqual } from 'lodash';

import { UrlQueryMap } from '@grafana/data';
import { sceneGraph, SceneObjectBase, SceneObjectState, VariableDependencyConfig } from '@grafana/scenes';
import { getClosestScopesFacade } from 'app/features/scopes';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';

export interface DashboardReloadBehaviorState extends SceneObjectState {
  reloadOnParamsChange?: boolean;
  uid?: string;
  version?: number;
}

export class DashboardReloadBehavior extends SceneObjectBase<DashboardReloadBehaviorState> {
  constructor(state: DashboardReloadBehaviorState) {
    const shouldReload = state.reloadOnParamsChange && state.uid;

    super(state);

    // Sometimes the reload is triggered multiple subsequent times
    // Debouncing it prevents double/triple reloads
    this.reloadDashboard = debounce(this.reloadDashboard).bind(this);

    if (shouldReload) {
      this.addActivationHandler(() => {
        getClosestScopesFacade(this)?.setState({
          handler: this.reloadDashboard,
        });

        this._variableDependency = new VariableDependencyConfig(this, {
          onAnyVariableChanged: this.reloadDashboard,
        });

        this._subs.add(
          sceneGraph.getTimeRange(this).subscribeToState((newState, prevState) => {
            if (!isEqual(newState.value, prevState.value)) {
              this.reloadDashboard();
            }
          })
        );

        this.reloadDashboard();
      });
    }
  }

  private isEditing() {
    return this.parent && 'isEditing' in this.parent.state && this.parent.state.isEditing;
  }

  private isWaitingForVariables() {
    const varSet = sceneGraph.getVariables(this.parent!);

    return varSet.state.variables.some((variable) => varSet.isVariableLoadingOrWaitingToUpdate(variable));
  }

  private reloadDashboard() {
    if (!this.isEditing() && !this.isWaitingForVariables()) {
      const timeRange = sceneGraph.getTimeRange(this);

      // This is wrapped in setTimeout in order to allow variables and scopes to be set in the URL before actually reloading the dashboard
      setTimeout(() => {
        getDashboardScenePageStateManager().reloadDashboard({
          version: this.state.version!,
          scopes: getClosestScopesFacade(this)?.value.map((scope) => scope.metadata.name) ?? [],
          // We're not using the getUrlState from timeRange since it makes more sense to pass the absolute timestamps as opposed to relative time
          timeRange: {
            from: timeRange.state.value.from.toISOString(),
            to: timeRange.state.value.to.toISOString(),
          },
          variables: sceneGraph.getVariables(this).state.variables.reduce<UrlQueryMap>(
            (acc, variable) => ({
              ...acc,
              ...variable.urlSync?.getUrlState(),
            }),
            {}
          ),
        });
      });
    }
  }
}
