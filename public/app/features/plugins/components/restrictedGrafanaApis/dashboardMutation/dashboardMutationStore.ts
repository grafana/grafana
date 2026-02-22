/**
 * Dashboard Mutation Client Store
 *
 * Module-level store for the active MutationClient reference.
 *
 * The client reference is stored here and not on the DashboardScene object tree
 * so that plugins cannot reach it via window.__grafanaSceneContext.
 */

import type { MutationClient } from 'app/features/dashboard-scene/mutation-api/types';

let _client: MutationClient | null = null;

export function setDashboardMutationClient(client: MutationClient | null): void {
  _client = client;
}

export function getDashboardMutationClient(): MutationClient | null {
  return _client;
}
