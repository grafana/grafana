/**
 * RELOAD_FROM_SERVER — reload the open dashboard from the server after something
 * else (for example Grafana Assistant editing a dashboard or its pending changes through the HTTP API)
 * saved a newer version, optionally switching which pending changes the page previews.
 * Refuses to discard unsaved changes in the open scene: it reports them instead, so the
 * caller can let the user decide.
 */

import { locationService } from '@grafana/runtime';

import {
  getPendingChangesHistory,
  PENDING_CHANGES_QUERY_PARAM,
  PENDING_CHANGES_VIEW_QUERY_PARAM,
  pendingChangesIdFromLocation,
  previewedDashboardUid,
} from '../../lifecycle/pendingChangePreview';
import { reloadKeepingEditMode } from '../../lifecycle/pendingChangesHistory';

import { payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';

export const reloadFromServerCommand: MutationCommand<{ pendingChanges?: string | null }> = {
  name: 'RELOAD_FROM_SERVER',
  description: payloads.reloadFromServer.description ?? '',

  payloadSchema: payloads.reloadFromServer,
  // Reloading never writes; the server already holds the newer version.
  permission: readOnly,
  readOnly: true,

  handler: async (payload, context) => {
    const { scene } = context;
    // A new dashboard proposed as pending changes reloads by the uid it was proposed under.
    const uid = previewedDashboardUid(scene.state);
    if (!uid) {
      return { success: false, error: 'The open dashboard has not been saved yet.', changes: [] };
    }
    // Pending changes whose history the plugin keeps record each edit as it is made: what's left
    // is defaults the scene filled in since, which reloading loses nothing of.
    if (scene.state.isDirty && !getPendingChangesHistory(scene.state)) {
      return { success: true, data: { reloaded: false, reason: 'unsaved-changes' }, changes: [] };
    }
    const preview = payload.pendingChanges;
    if (preview !== undefined && (preview ?? undefined) !== pendingChangesIdFromLocation()) {
      // The page loads a new scene for the other preview (DashboardScenePage); replace: same page.
      locationService.partial(
        { [PENDING_CHANGES_QUERY_PARAM]: preview, [PENDING_CHANGES_VIEW_QUERY_PARAM]: null },
        true
      );
      return { success: true, data: { reloaded: false, reason: 'switched-preview' }, changes: [] };
    }
    try {
      // A full load, so new or updated pending changes show too, in edit mode if it was editing.
      await reloadKeepingEditMode(uid, scene.state.isEditing);
      return { success: true, data: { reloaded: true }, changes: [] };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error), changes: [] };
    }
  },
};
