/**
 * ENTER_EDIT_MODE command
 *
 * Enters edit mode on the dashboard. Required before making mutations
 * if the dashboard is not already in edit mode.
 */

import { emptyPayloadSchema } from './schemas';
import { requiresEdit, type CommandDefinition } from './types';

export const enterEditModeCommand: CommandDefinition<Record<string, never>> = {
  name: 'ENTER_EDIT_MODE',
  description: 'Enter edit mode on the dashboard. Required before making mutations if not already in edit mode.',

  payloadSchema: emptyPayloadSchema,
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
