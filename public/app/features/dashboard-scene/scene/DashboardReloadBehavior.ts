import { debounce, isEqual } from 'lodash';

import { UrlQueryMap } from '@grafana/data';
import { RefreshEvent } from '@grafana/runtime';
import { sceneGraph, SceneObjectBase, SceneObjectState, VariableDependencyConfig } from '@grafana/scenes';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';

export interface DashboardReloadBehaviorState extends SceneObjectState {
  reloadOnParamsChange?: boolean;
  uid?: string;
  version?: number;
}

export class DashboardReloadBehavior extends SceneObjectBase<DashboardReloadBehaviorState> {
  constructor(state: DashboardReloadBehaviorState) {
    super(state);

    // Sometimes the reload is triggered multiple subsequent times
    // Debouncing it prevents double/triple reloads
    this.reloadDashboard = debounce(this.reloadDashboard).bind(this);

    const shouldReload = this.state.uid && this.state.reloadOnParamsChange;
    const shouldRefresh = this.state.uid && !this.state.reloadOnParamsChange;

    if (shouldReload) {
      this._variableDependency = new VariableDependencyConfig(this, {
        onAnyVariableChanged: this.reloadDashboard,
      });
    }

    this.addActivationHandler(() => {
      this._subs.add(
        sceneGraph.getScopesBridge(this)?.subscribeToValue((newScopes, prevScopes) => {
          if (newScopes !== prevScopes) {
            if (shouldRefresh) {
              sceneGraph.getTimeRange(this).onRefresh();
              this.publishEvent(new RefreshEvent(), true);
            } else if (shouldReload) {
              this.reloadDashboard();
            }
          }
        })
      );

      if (shouldReload) {
        this._subs.add(
          sceneGraph.getTimeRange(this).subscribeToState((newState, prevState) => {
            if (!isEqual(newState.value, prevState.value)) {
              this.reloadDashboard();
            }
          })
        );

        this.reloadDashboard();
      }
    });
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
          scopes:
            sceneGraph
              .getScopesBridge(this)
              ?.getValue()
              .map((scope) => scope.metadata.name) ?? [],
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
