/**
 * Dashboard Mutation Client
 *
 * Implements the DashboardMutationAPI.MutationClient interface,
 * providing a clean public API for dashboard mutations.
 */

import { DashboardMutationAPI } from '@grafana/runtime';

import type { DashboardScene } from '../scene/DashboardScene';

import { MutationExecutor } from './MutationExecutor';

/**
 * Dashboard Mutation Client
 *
 * Implements the public mutation API interface and manages:
 * - The underlying MutationExecutor
 * - Registration with @grafana/runtime and window
 */
export class DashboardMutationClient implements DashboardMutationAPI.MutationClient {
  private executor: MutationExecutor;
  private dashboardUid: string | undefined;

  constructor(scene: DashboardScene) {
    this.executor = new MutationExecutor(scene);
    this.dashboardUid = scene.state.uid;
  }

  /**
   * The UID of the dashboard this client is bound to.
   * Consumers can check this to verify they're targeting the expected dashboard.
   */
  get uid(): string | undefined {
    return this.dashboardUid;
  }

  /**
   * Execute a mutation on the dashboard.
   */
  execute(mutation: DashboardMutationAPI.MutationRequest): Promise<DashboardMutationAPI.MutationResult> {
    return this.executor.execute(mutation);
  }

  /**
   * Register this client as the active mutation API.
   * Exposes the API via @grafana/runtime (which also sets window for cross-bundle access).
   */
  register(): void {
    DashboardMutationAPI.setDashboardMutationAPI(this);
  }

  /**
   * Unregister this client and clear the mutation API.
   */
  unregister(): void {
    DashboardMutationAPI.setDashboardMutationAPI(null);
  }
}
