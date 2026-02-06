/**
 * Dashboard Mutation Client
 *
 * Implements the DashboardMutationAPI.MutationClient interface,
 * providing a clean public API for dashboard mutations.
 */

import { DashboardMutationAPI } from '@grafana/runtime';

import type { DashboardScene } from '../scene/DashboardScene';

import { MutationExecutor } from './MutationExecutor';
import { DASHBOARD_COMMAND_SCHEMAS } from './commandSchemas';

/**
 * Dashboard Mutation Client
 *
 * Implements the public mutation API interface and manages:
 * - The underlying MutationExecutor
 * - Schema lookups for commands
 * - Registration with @grafana/runtime and window
 */
export class DashboardMutationClient implements DashboardMutationAPI.MutationClient {
  private executor: MutationExecutor;
  private dashboardUid: string | undefined;

  constructor(scene: DashboardScene) {
    this.executor = new MutationExecutor();
    this.executor.setScene(scene);
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
   * Get the JSON schema for a command (for validation).
   * Returns null if command is not found.
   */
  getSchema(command: string): DashboardMutationAPI.MutationCommand | null {
    const normalizedCommand = command.toLowerCase();
    const schema = DASHBOARD_COMMAND_SCHEMAS.find((s) => s.name.toLowerCase() === normalizedCommand);
    if (!schema) {
      return null;
    }
    return {
      command: schema.name,
      description: schema.description,
      inputSchema: schema.inputSchema,
    };
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
