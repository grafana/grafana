/**
 * GET_DASHBOARD_INFO command
 *
 * Returns dashboard metadata (title, description, uid, tags, folder info,
 * timestamps) from the DashboardScene state. Read-only, no permissions required.
 */

import { payloads } from './schemas';
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
      const { title, description, uid, tags, meta } = scene.state;

      return {
        success: true,
        data: {
          title: title ?? '',
          description: description ?? '',
          uid: uid ?? '',
          tags: tags ?? [],
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
