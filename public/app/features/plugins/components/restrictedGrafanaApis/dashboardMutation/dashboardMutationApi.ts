/**
 * Dashboard Mutation API -- Restricted API wrapper with built-in store.
 *
 * This module manages the single active MutationClient instance and provides
 * the API object that is exposed to plugins via RestrictedGrafanaApis.
 *
 * DashboardScene sets/clears the client on activation/deactivation.
 * Plugins access it through RestrictedGrafanaApis context -- they cannot
 * import this module directly because it lives inside the core bundle.
 */

import type { DashboardMutationAPI } from '@grafana/data';
import { ALL_COMMANDS } from 'app/features/dashboard-scene/mutation-api';
import type { MutationClient, MutationRequest } from 'app/features/dashboard-scene/mutation-api/types';

let _client: MutationClient | null = null;

export function setDashboardMutationClient(client: MutationClient | null): void {
  _client = client;
}

export const dashboardMutationApi: DashboardMutationAPI = {
  execute: (mutation: MutationRequest) => {
    if (!_client) {
      return Promise.reject(new Error('Dashboard Mutation API is not available. No dashboard is currently loaded.'));
    }
    return _client.execute(mutation);
  },
  getPayloadSchema: (commandId: string) => {
    const normalized = commandId.toUpperCase();
    const cmd = ALL_COMMANDS.find((c) => c.name === normalized);
    return cmd?.payloadSchema ?? null;
  },
};
