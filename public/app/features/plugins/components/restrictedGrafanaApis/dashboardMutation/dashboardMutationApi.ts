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
const _availabilityListeners = new Set<(isAvailable: boolean) => void>();

function setClient(client: MutationClient | null): void {
  if (_client === client) {
    return;
  }
  _client = client;

  for (const listener of _availabilityListeners) {
    try {
      listener(_client !== null);
    } catch (error) {
      console.error('Dashboard Mutation API availability listener threw:', error);
    }
  }
}

provideMutationClientFactory((sceneObject) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const scene = sceneObject as unknown as DashboardScene;

  let client: MutationClient | null = null;
  try {
    client = new DashboardMutationClient(scene);
    setClient(client);
  } catch (error) {
    console.error('Failed to register Dashboard Mutation API:', error);
  }

  return () => {
    // Only the scene that owns the live client may clear it. Two dashboard
    // scenes can be mounted at once, and without this the first to deactivate
    // takes the survivor's client with it.
    if (client && _client === client) {
      setClient(null);
    }
  };
});

/** @internal — exposed only for unit tests that need to inject a mock client. */
export function setDashboardMutationClientForTests(client: MutationClient | null): void {
  setClient(client);
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
  canExecute: (commands) => {
    const requested = typeof commands === 'string' ? [commands] : commands;
    if (requested.length === 0) {
      return { allowed: true };
    }
    if (!_client) {
      return {
        allowed: false,
        blocked: requested.map((command) => ({
          command: command.toUpperCase(),
          reason: 'No dashboard is currently open, so there is nothing to mutate.',
        })),
      };
    }
    return _client.canExecute(requested);
  },
  isAvailable: () => {
    return _client !== null;
  },
  onAvailabilityChange: (listener) => {
    _availabilityListeners.add(listener);
    return () => {
      _availabilityListeners.delete(listener);
    };
  },
};
