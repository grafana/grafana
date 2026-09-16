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
  readOnly: false,

  handler: async (_payload, context) => {
    const { scene } = context;

    try {
      // A plan preview is a static, view-mode surface by design (see enterEditModeIfNeeded in
      // types.ts) — it must never enter edit mode, including via this command called directly.
      // Without this check, a caller invoking ENTER_EDIT_MODE while planning would bypass that
      // guarantee entirely, independent of every other mutation command's own planning check.
      if (scene.isPlanning()) {
        return {
          success: false,
          error: 'Cannot enter edit mode while a dashboard plan is being previewed.',
          changes: [],
        };
      }

      const wasEditing = scene.state.isEditing ?? false;

      if (!wasEditing) {
        scene.onEnterEditMode('assistant');
      }

      return {
        success: true,
        changes: [{ path: '/isEditing', previousValue: wasEditing, newValue: true }],
        data: { wasAlreadyEditing: wasEditing, isEditing: true },
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
