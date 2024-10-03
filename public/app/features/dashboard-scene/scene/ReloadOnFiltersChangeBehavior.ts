import { SceneObjectBase, SceneObjectState, VariableDependencyConfig } from '@grafana/scenes';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';

export interface ReloadOnFiltersChangeBehaviorState extends SceneObjectState {
  reloadOnFiltersChange?: string[] | boolean;
  uid?: string;
}

export class ReloadOnFiltersChangeBehavior extends SceneObjectBase<ReloadOnFiltersChangeBehaviorState> {
  public constructor(state: ReloadOnFiltersChangeBehaviorState) {
    super(state);

    if (state.reloadOnFiltersChange && state.uid) {
      this._variableDependency = new VariableDependencyConfig(
        this,
        state.reloadOnFiltersChange === true
          ? {
              onAnyVariableChanged: this.reloadDashboard.bind(this),
            }
          : {
              variableNames: state.reloadOnFiltersChange,
              onVariableUpdateCompleted: this.reloadDashboard.bind(this),
            }
      );
    }
  }

  private isEditing() {
    return this.parent && 'isEditing' in this.parent.state && this.parent.state.isEditing;
  }

  private reloadDashboard() {
    if (!this.isEditing()) {
      getDashboardScenePageStateManager().reloadDashboard();
    }
  }
}
