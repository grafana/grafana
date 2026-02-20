/**
 * Dashboard Mutation Behavior
 *
 * Manages the lifecycle of the Dashboard Mutation API.
 * Added to DashboardScene's $behaviors in the serializers.
 *
 * On activation:
 *   - Creates a DashboardMutationClient for the parent DashboardScene
 *   - Registers it in the module-level store (dashboardMutationStore)
 *
 * On deactivation:
 *   - Unregisters the client from the store
 *
 * SECURITY: This behavior intentionally does NOT implement MutationClient
 * or expose an execute() method. It is reachable by plugins via
 * window.__grafanaSceneContext.state.$behaviors, so it must not provide
 * any mutation capabilities. The actual client is stored only in the
 * module-level store, accessible exclusively through RestrictedGrafanaApis.
 */

import { sceneGraph, SceneObjectBase, type SceneObjectState } from '@grafana/scenes';
import { setDashboardMutationClient } from 'app/features/plugins/components/restrictedGrafanaApis/dashboardMutation/dashboardMutationStore';

import { DashboardScene } from '../scene/DashboardScene';

import { DashboardMutationClient } from './DashboardMutationClient';

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
