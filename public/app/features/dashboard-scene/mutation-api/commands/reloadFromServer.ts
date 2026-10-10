/**
 * RELOAD_FROM_SERVER — reload the open dashboard from the server after something
 * else (for example Grafana Assistant editing a draft or fork through the HTTP API)
 * saved a newer version. Refuses to discard unsaved changes in the open scene: it
 * reports them instead, so the caller can let the user decide.
 */

import { locationService } from '@grafana/runtime';

import { payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';

export const reloadFromServerCommand: MutationCommand<Record<string, never>> = {
  name: 'RELOAD_FROM_SERVER',
  description: payloads.reloadFromServer.description ?? '',

  payloadSchema: payloads.reloadFromServer,
  // Reloading never writes; the server already holds the newer version.
  permission: readOnly,
  readOnly: true,

  handler: async (_payload, context) => {
    const { scene } = context;
    const uid = scene.state.uid;
    if (!uid) {
      return { success: false, error: 'The open dashboard has not been saved yet.', changes: [] };
    }
    if (scene.state.isDirty) {
      return { success: true, data: { reloaded: false, reason: 'unsaved-changes' }, changes: [] };
    }
    try {
      const { getDashboardScenePageStateManager } = await import('../../pages/DashboardScenePageStateManager');
      const manager = getDashboardScenePageStateManager();
      manager.removeSceneCache(uid);
      await manager.reloadDashboard(locationService.getSearchObject());
      return { success: true, data: { reloaded: true }, changes: [] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error), changes: [] };
    }
  },
};
