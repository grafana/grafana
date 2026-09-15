/**
 * Dashboard Mutation API -- Restricted API wrapper with built-in store.
 *
 * This module manages the single active MutationClient instance and provides
 * the API object that is exposed to plugins via RestrictedGrafanaApis.
 *
 * The mutation client is created/destroyed automatically when a document's scene
 * activates/deactivates, via the clientBridge. More than one document can be mounted at once —
 * a notebook rendered outside the notebooks route sits over whatever else is on screen — so the
 * clients form a stack and the most recently activated one serves the API.
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

/**
 * Mounted documents, most recently activated last. A stack rather than a single slot because
 * unmounting one must hand the API back to whichever document is still on screen: clearing it
 * outright left a dashboard's client dead after an embedded notebook over it went away.
 */
const _clients: MutationClient[] = [];

function currentClient(): MutationClient | null {
  return _clients[_clients.length - 1] ?? null;
}

provideMutationClientFactory((sceneObject, resource) => {
  let client: MutationClient;
  try {
    if (resource === 'notebook') {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the bridge erases the scene type; `resource` is what says which it is
      client = new NotebookMutationClient(sceneObject as NotebookScene);
    } else {
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- the bridge erases the scene type; `resource` is what says which it is
      client = new DashboardMutationClient(sceneObject as DashboardScene);
    }
  } catch (error) {
    console.error('Failed to register Dashboard Mutation API:', error);
    return () => {};
  }

  _clients.push(client);

  // Spliced out by identity rather than popped: documents do not always deactivate in the order
  // they activated, and popping would evict whichever one happens to be on top.
  return () => {
    const index = _clients.lastIndexOf(client);
    if (index !== -1) {
      _clients.splice(index, 1);
    }
  };
});

/** @internal — exposed only for unit tests that need to inject a mock client. */
export function setDashboardMutationClientForTests(client: MutationClient | null): void {
  _clients.length = 0;
  if (client) {
    _clients.push(client);
  }
}

export const dashboardMutationApi: DashboardMutationAPI = {
  // Static, and readable with no document mounted: a plugin that ships on its own cadence has to be
  // able to ask what this Grafana build supports before it navigates anywhere. `getAvailableCommands()`
  // cannot answer that — it is empty until a scene activates, which says nothing about the build.
  capabilities: {
    planning: true,
  },
  execute: (mutation: MutationRequest) => {
    const client = currentClient();
    if (!client) {
      return Promise.reject(new Error('Dashboard Mutation API is not available. No dashboard is currently loaded.'));
    }
    return client.execute(mutation);
  },
  getPayloadSchema: (commandId: string) => {
    const normalized = commandId.toUpperCase();
    // Every command, not just the ones the mounted document exposes: `execute` is what enforces where a
    // command can run.
    const cmd = allMutationCommands().find((c) => c.name === normalized);
    return cmd?.payloadSchema ?? null;
  },
  getAvailableCommands: () => {
    return currentClient()?.getAvailableCommands() ?? [];
  },
};
