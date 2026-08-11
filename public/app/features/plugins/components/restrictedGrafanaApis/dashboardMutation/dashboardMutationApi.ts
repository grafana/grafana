/**
 * Dashboard Mutation API -- Restricted API wrapper with built-in store.
 *
 * This module manages the single active MutationClient instance and provides
 * the API object that is exposed to plugins via RestrictedGrafanaApis.
 *
 * The mutation client is created/destroyed automatically when a document's scene
 * activates/deactivates, via the clientBridge. Which client it is depends on what
 * is mounted -- a dashboard and a notebook expose different commands -- and only
 * one document is ever mounted at a time, so there is one slot.
 * Plugins access it through RestrictedGrafanaApis context -- they cannot
 * import this module directly because it lives inside the core bundle.
 */

import type { DashboardMutationAPI } from '@grafana/data';
import { DashboardMutationClient } from 'app/features/dashboard-scene/mutation-api/DashboardMutationClient';
import { provideMutationClientFactory } from 'app/features/dashboard-scene/mutation-api/clientBridge';
import type { MutationClient, MutationRequest } from 'app/features/dashboard-scene/mutation-api/types';
import type { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { NotebookMutationClient } from 'app/features/notebook/mutation-api/NotebookMutationClient';
import type { NotebookScene } from 'app/features/notebook/scene/NotebookScene';

import { allMutationCommands } from './commandRegistry';

let _client: MutationClient | null = null;

provideMutationClientFactory((sceneObject, resource) => {
  try {
    if (resource === 'notebook') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the bridge erases the scene type; `resource` is what says which it is
      _client = new NotebookMutationClient(sceneObject as NotebookScene);
    } else {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the bridge erases the scene type; `resource` is what says which it is
      _client = new DashboardMutationClient(sceneObject as DashboardScene);
    }
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
    // Every command, not just the ones the mounted document exposes: a caller may fetch a schema to
    // decide whether to navigate somewhere it applies. `execute` is what enforces where it can run.
    const cmd = allMutationCommands().find((c) => c.name === normalized);
    return cmd?.payloadSchema ?? null;
  },
  getAvailableCommands: () => {
    return _client?.getAvailableCommands() ?? [];
  },
};
