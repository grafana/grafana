/**
 * Dashboard Mutation Client Store
 *
 * Module-level store for the active MutationClient reference.
 * This is intentionally a leaf module with no dependencies on the
 * mutation command registry, so it can be imported by the mutation
 * behavior without creating circular dependencies.
 *
 * SECURITY: The client reference is stored here (not on the DashboardScene
 * object tree) so that plugins cannot reach it via
 * window.__grafanaSceneContext. Plugins access mutations exclusively
 * through RestrictedGrafanaApis.
 */

import type { MutationClient } from 'app/features/dashboard-scene/mutation-api/types';

let _client: MutationClient | null = null;

export function setDashboardMutationClient(client: MutationClient | null): void {
  _client = client;
}

export function getDashboardMutationClient(): MutationClient | null {
  return _client;
}
