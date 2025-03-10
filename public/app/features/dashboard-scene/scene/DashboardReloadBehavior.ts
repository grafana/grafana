import { debounce, isEqual } from 'lodash';

import { UrlQueryMap } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneScopesBridge,
  SceneTimeRangeLike,
  VariableDependencyConfig,
} from '@grafana/scenes';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';

import { DashboardScene } from './DashboardScene';

export interface DashboardReloadBehaviorState extends SceneObjectState {
  reloadOnParamsChange?: boolean;
  uid?: string;
  version?: number;
}

export class DashboardReloadBehavior extends SceneObjectBase<DashboardReloadBehaviorState> {
  private _timeRange: SceneTimeRangeLike | undefined;
  private _scopesBridge: SceneScopesBridge | undefined;
  private _dashboardScene: DashboardScene | undefined;

  constructor(state: DashboardReloadBehaviorState) {
    super(state);

    // Sometimes the reload is triggered multiple subsequent times
    // Debouncing it prevents double/triple reloads
    this.reloadDashboard = debounce(this.reloadDashboard).bind(this);

    const shouldReload = !!this.state.uid && !!this.state.reloadOnParamsChange;

    this.addActivationHandler(() => {
      if (!shouldReload) {
        return;
      }

      this._timeRange = sceneGraph.getTimeRange(this);
      this._scopesBridge = sceneGraph.getScopesBridge(this);
      this._dashboardScene = sceneGraph.getAncestor(this, DashboardScene);

      this._variableDependency = new VariableDependencyConfig(this, {
        onAnyVariableChanged: this.reloadDashboard,
      });

      this._scopesBridge?.subscribeToValue(() => {
        if (shouldReload) {
          this.reloadDashboard();
        }
      });

      this._subs.add(
        this._timeRange.subscribeToState((newState, prevState) => {
          if (!isEqual(newState.value, prevState.value)) {
            this.reloadDashboard();
          }
        })
      );

      this.reloadDashboard();
    });
  }

  private isEditing() {
    return !!this._dashboardScene?.state.isEditing;
  }

  private isWaitingForVariables() {
    const varSet = sceneGraph.getVariables(this.parent!);

    return varSet.state.variables.some((variable) => varSet.isVariableLoadingOrWaitingToUpdate(variable));
  }

  private reloadDashboard() {
    if (this.isEditing() || this.isWaitingForVariables()) {
      return;
    }

    // This is wrapped in setTimeout in order to allow variables and scopes to be set in the URL before actually reloading the dashboard
    setTimeout(() => {
      getDashboardScenePageStateManager().reloadDashboard({
        version: this.state.version!,
        scopes: this._scopesBridge?.getValue().map((scope) => scope.metadata.name) ?? [],
        // We're not using the getUrlState from timeRange since it makes more sense to pass the absolute timestamps as opposed to relative time
        timeRange: {
          from: this._timeRange!.state.value.from.toISOString(),
          to: this._timeRange!.state.value.to.toISOString(),
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
