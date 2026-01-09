/**
 * ENTER_EDIT_MODE command
 *
 * Enters edit mode on the dashboard. Required before making mutations
 * if the dashboard is not already in edit mode.
 */

import { payloads } from './schemas';
import { requiresEdit, type MutationCommand } from './types';

export const enterEditModeCommand: MutationCommand<Record<string, never>> = {
  name: 'ENTER_EDIT_MODE',
  description: payloads.enterEditMode.description ?? '',

  payloadSchema: payloads.enterEditMode,
  permission: requiresEdit,

  handler: async (_payload, context) => {
    const { scene, transaction } = context;

    try {
      const wasEditing = scene.state.isEditing ?? false;

      if (!wasEditing) {
        scene.onEnterEditMode();
      }

      const changes = [
        {
          path: '/isEditing',
          previousValue: wasEditing,
          newValue: true,
        },
      ];
      transaction.changes.push(...changes);

      return {
        success: true,
        changes,
        data: {
          wasAlreadyEditing: wasEditing,
          isEditing: true,
        },
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
