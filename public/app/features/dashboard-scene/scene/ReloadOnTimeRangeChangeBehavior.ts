import { isEqual } from 'lodash';

import { sceneGraph, SceneObjectBase, SceneObjectState } from '@grafana/scenes';

import { getDashboardScenePageStateManager } from '../pages/DashboardScenePageStateManager';

export interface ReloadOnTimeRangeChangeBehaviorState extends SceneObjectState {
  reloadOnTimeRangeChange?: boolean;
  uid?: string;
}

export class ReloadOnTimeRangeChangeBehavior extends SceneObjectBase<ReloadOnTimeRangeChangeBehaviorState> {
  public constructor(state: ReloadOnTimeRangeChangeBehaviorState) {
    super(state);

    this.addActivationHandler(() => this._activationHandler());
  }

  private _activationHandler() {
    if (!this.state.reloadOnTimeRangeChange || !this.state.uid) {
      return;
    }

    const sub = sceneGraph.getTimeRange(this).subscribeToState((newState, prevState) => {
      if (!isEqual(newState.value, prevState.value) && !this.isEditing()) {
        // We need to wait for the query params to be updated before reloading as we pass those query params to the dashboard API
        setTimeout(() => this.reloadDashboard());
      }
    });

    return () => {
      sub.unsubscribe();
    };
  }

  private isEditing() {
    return this.parent && 'isEditing' in this.parent?.state && this.parent?.state.isEditing;
  }

  private reloadDashboard() {
    getDashboardScenePageStateManager().reloadDashboard();
  }
}
