/**
 * Dashboard Mutation API -- Restricted API wrapper with built-in store.
 *
 * This module manages the single active MutationClient instance and provides
 * the API object that is exposed to plugins via RestrictedGrafanaApis.
 *
 * The mutation client is created/destroyed automatically when a DashboardScene
 * activates/deactivates, via the DashboardMutationClientSetter bridge.
 * Plugins access it through RestrictedGrafanaApis context -- they cannot
 * import this module directly because it lives inside the core bundle.
 */

import type { DashboardMutationAPI } from '@grafana/data';
import { ALL_COMMANDS } from 'app/features/dashboard-scene/mutation-api';
import { DashboardMutationClient } from 'app/features/dashboard-scene/mutation-api/DashboardMutationClient';
import type { MutationClient, MutationRequest } from 'app/features/dashboard-scene/mutation-api/types';
import { provideMutationClientFactory } from 'app/features/dashboard-scene/scene/DashboardMutationClientSetter';
import type { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';

let _client: MutationClient | null = null;

provideMutationClientFactory((sceneObject) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const scene = sceneObject as unknown as DashboardScene;

  try {
    _client = new DashboardMutationClient(scene);
  } catch (error) {
    console.error('Failed to register Dashboard Mutation API:', error);
  }

  return () => {
    _client = null;
  };
});

/** @internal — exposed only for unit tests that need to inject a mock client. */
export function setDashboardMutationClientForTests(client: MutationClient | null): void {
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
  getAvailableCommands: () => {
    return _client?.getAvailableCommands() ?? [];
  },
};
