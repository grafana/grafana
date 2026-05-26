/**
 * REDO command
 *
 * Redo the last undone mutation. Counterpart to UNDO; both go through the
 * dashboard's MutationRecorder so the in-memory stack stays consistent
 * regardless of caller.
 */

import { payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';

export const redoCommand: MutationCommand<Record<string, never>> = {
  name: 'REDO',
  description: payloads.redo.description ?? '',

  payloadSchema: payloads.redo,
  permission: readOnly,
  readOnly: false,

  handler: async (_payload, context) => {
    const { scene } = context;
    const ok = scene.mutationRecorder.redo();
    if (!ok) {
      return { success: false, error: 'Nothing to redo', changes: [] };
    }
    return { success: true, changes: [{ path: '/redo', previousValue: null, newValue: null }] };
  },
};
