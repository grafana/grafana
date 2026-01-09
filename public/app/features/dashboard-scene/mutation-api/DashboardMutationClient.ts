/**
 * Dashboard Mutation Client
 *
 * Implements the MutationClient interface, providing a clean public API
 * for dashboard mutations. Lifecycle is managed by DashboardScene via
 * the module-level store in dashboardMutationApi.ts.
 */

import type { DashboardScene } from '../scene/DashboardScene';

import { MutationExecutor } from './MutationExecutor';
import type { MutationClient, MutationRequest, MutationResult } from './types';

export class DashboardMutationClient implements MutationClient {
  private executor: MutationExecutor;

  constructor(scene: DashboardScene) {
    this.executor = new MutationExecutor(scene);
  }

  execute(mutation: MutationRequest): Promise<MutationResult> {
    return this.executor.execute(mutation);
  }
}
