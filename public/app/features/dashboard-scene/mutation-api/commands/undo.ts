/**
 * UNDO command
 *
 * Undo the last recorded mutation. Dispatches into the dashboard's
 * MutationRecorder, which holds the in-memory undo stack. The toolbar undo
 * button and the agent share this path — the recorder does not care who
 * triggered the request.
 */

import { payloads } from './schemas';
import { readOnly, type MutationCommand } from './types';

export const undoCommand: MutationCommand<Record<string, never>> = {
  name: 'UNDO',
  description: payloads.undo.description ?? '',

  payloadSchema: payloads.undo,
  permission: readOnly,
  // Undo mutates state but the recorder owns its own pre/post bookkeeping.
  // The mutation client should not snapshot or push another entry.
  readOnly: false,

  handler: async (_payload, context) => {
    const { scene } = context;
    const ok = scene.mutationRecorder.undo();
    if (!ok) {
      return { success: false, error: 'Nothing to undo', changes: [] };
    }
    return { success: true, changes: [{ path: '/undo', previousValue: null, newValue: null }] };
  },
};
