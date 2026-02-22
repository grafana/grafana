import { sceneGraph, SceneObjectBase, type SceneObjectState } from '@grafana/scenes';

import { DashboardScene } from '../scene/DashboardScene';

import { DashboardMutationClient } from './DashboardMutationClient';
import { setDashboardMutationClient } from './dashboardMutationStore';

export class DashboardMutationBehavior extends SceneObjectBase<SceneObjectState> {
  constructor() {
    super({});
    this.addActivationHandler(() => this._onActivate());
  }

  private _onActivate() {
    try {
      const scene = sceneGraph.getAncestor(this, DashboardScene);
      const client = new DashboardMutationClient(scene);
      setDashboardMutationClient(client);
    } catch (error) {
      console.error('Failed to register Dashboard Mutation API:', error);
      return;
    }

    return () => {
      setDashboardMutationClient(null);
    };
  }
}
