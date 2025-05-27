import { debounce, isEqual } from 'lodash';

import { UrlQueryMap } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  SceneTimeRangeLike,
  sceneUtils,
  SceneVariable,
  VariableDependencyConfig,
} from '@grafana/scenes';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';

import { DashboardScene } from './DashboardScene';

export interface DashboardReloadBehaviorState extends SceneObjectState {
  reloadOnParamsChange?: boolean;
  uid?: string;
}

export class DashboardReloadBehavior extends SceneObjectBase<DashboardReloadBehaviorState> {
  private _timeRange: SceneTimeRangeLike | undefined;
  private _dashboardScene: DashboardScene | undefined;
  private _initialState?: UrlQueryMap;

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
      this._dashboardScene = sceneGraph.getAncestor(this, DashboardScene);

      this._variableDependency = new VariableDependencyConfig(this, {
        onAnyVariableChanged: (variable: SceneVariable) => {
          console.log('onAnyVariableChanged', variable.state.name, JSON.stringify(variable.getValue()));
          this.reloadDashboard();
        },
        dependsOnScopes: true,
      });

      this._subs.add(this._timeRange.subscribeToState(() => this.reloadDashboard()));
    });
  }

  private getCurrentState() {
    const scopes = sceneGraph.getScopes(this) ?? [];

    return {
      scopes: scopes.map((scope) => scope.metadata.name),
      ...sceneUtils.getUrlState(this._dashboardScene?.state.$timeRange!),
      ...sceneUtils.getUrlState(this._dashboardScene?.state.$variables!),
      version: this._dashboardScene?.state.version,
    };
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
      console.log('DashboardReloadBehavior reloadDashboard isEditing or waiting for variables, skipping reload');
      return;
    }

    // If we have not captured an initial state yet it means variables where still loading (probably means scopes are loading)
    if (!this._initialState) {
      this._initialState = this.getCurrentState();
      console.log('DashboardReloadBehavior saving initial state after variables completed', this._initialState);
      return;
    }

    const newState = this.getCurrentState();
    const stateChanged = !isEqual(newState, this._initialState);

    console.log(
      `DashboardReloadBehavior reloadDashboard stateChanged ${stateChanged ? 'true' : 'false'}`,
      this._initialState,
      newState
    );

    if (!stateChanged) {
      return;
    }

    // This is wrapped in setTimeout in order to allow variables and scopes to be set in the URL before actually reloading the dashboard
    setTimeout(() => {
      getDashboardScenePageStateManager().reloadDashboard(newState);
    });
  }
}
