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
      // enterEditModeIfNeeded (types.ts) skips entering edit mode for the other ~30 commands
      // while a plan preview is active, letting them still mutate the preview without flipping
      // it into edit mode. That doesn't resolve this command: its entire job is entering edit
      // mode, and there is no sensible "run it anyway" -- silently succeeding without actually
      // entering edit mode would be a lie to the caller. Refuse it outright instead, the way the
      // other guarded routes do.
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
