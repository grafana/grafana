/**
 * Dashboard Mutation Client
 *
 * API for programmatic dashboard mutations. Provides
 * a declarative, command-based API where callers describe *what* to
 * change (e.g. ADD_VARIABLE, UPDATE_VARIABLE) and the executor handles Scenes
 * internals, payload validation (via Zod schemas), permission checks, and
 * transactional execution with structured error responses.
 */

import { MutationExecutor } from './MutationExecutor';
import type { MutableDashboardScene, MutationClient, MutationRequest, MutationResult } from './types';

export class DashboardMutationClient implements MutationClient {
  private executor: MutationExecutor;

  constructor(scene: MutableDashboardScene) {
    this.executor = new MutationExecutor(scene);
  }

  execute(mutation: MutationRequest): Promise<MutationResult> {
    return this.executor.execute(mutation);
  }
}
