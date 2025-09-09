import { debounce, isEqual } from 'lodash';

import { UrlQueryMap } from '@grafana/data';
import {
  sceneGraph,
  SceneObjectBase,
  SceneObjectState,
  sceneUtils,
  SceneVariable,
  VariableDependencyConfig,
} from '@grafana/scenes';
import { createLogger } from '@grafana/ui';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';

import { DashboardScene } from './DashboardScene';

export interface DashboardReloadBehaviorState extends SceneObjectState {
  reloadOnParamsChange?: boolean;
  uid?: string;
}

export class DashboardReloadBehavior extends SceneObjectBase<DashboardReloadBehaviorState> {
  private _dashboardScene: DashboardScene | undefined;
  private _prevState?: UrlQueryMap;
  private _log = createLogger('DashboardReloadBehavior');

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

      this._dashboardScene = sceneGraph.getAncestor(this, DashboardScene);

      this._variableDependency = new VariableDependencyConfig(this, {
        onAnyVariableChanged: (variable: SceneVariable) => {
          this._log.logger('onAnyVariableChanged', variable.state.name, JSON.stringify(variable.getValue()));
          this.reloadDashboard();
        },
        dependsOnScopes: true,
      });
    });
  }

  private getCurrentState(): UrlQueryMap {
    const scopes = sceneGraph.getScopes(this) ?? [];
    const timeRange = sceneGraph.getTimeRange(this).state.value;

    return {
      scopes: scopes.map((scope) => scope.metadata.name),
      from: timeRange.from.toISOString(),
      to: timeRange.to.toISOString(),
      ...sceneUtils.getUrlState(this._dashboardScene?.state.$variables!),
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
      this._log.logger('DashboardReloadBehavior reloadDashboard isEditing or waiting for variables, skipping reload');
      return;
    }

    const newState = this.getCurrentState();
    const prevState = this._prevState ?? {};

    // Ignore time range changes for now
    prevState.from = newState.from;
    prevState.to = newState.to;

    const stateChanged = !isEqual(newState, this._prevState);

    this._log.logger(
      `DashboardReloadBehavior reloadDashboard stateChanged ${stateChanged ? 'true' : 'false'}`,
      this._prevState,
      newState
    );

    if (!stateChanged) {
      return;
    }

    this._prevState = newState;

    // This is wrapped in setTimeout in order to allow variables and scopes to be set in the URL before actually reloading the dashboard
    setTimeout(() => {
      getDashboardScenePageStateManager().reloadDashboard(newState);
    });
  }
}
