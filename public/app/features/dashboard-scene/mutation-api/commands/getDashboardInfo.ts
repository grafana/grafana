/**
 * GET_DASHBOARD_INFO command
 *
 * Returns dashboard identity/folder metadata plus every dashboard-level setting
 * that UPDATE_DASHBOARD_SETTINGS can write (title, description, tags, editable,
 * refresh, time range, timezone, cursorSync, links), read from the
 * DashboardScene state. Read-only, no permissions required.
 */

import { payloads } from './schemas';
import { readDashboardSettings } from './shared';
import { readOnly, type MutationCommand } from './types';

export const getDashboardInfoCommand: MutationCommand<Record<string, never>> = {
  name: 'GET_DASHBOARD_INFO',
  description: payloads.getDashboardInfo.description ?? '',

  payloadSchema: payloads.getDashboardInfo,
  permission: readOnly,
  readOnly: true,

  handler: async (_payload, context) => {
    const { scene } = context;

    try {
      const { uid, meta } = scene.state;

      return {
        success: true,
        data: {
          ...readDashboardSettings(scene),
          uid: uid ?? '',
          ...(meta && {
            folderTitle: meta.folderTitle,
            folderUid: meta.folderUid,
            created: meta.created,
            updated: meta.updated,
          }),
        },
        changes: [],
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        changes: [],
      };
    }
  },
};
