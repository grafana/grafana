/**
 * opApplicator — applies remote operations to the local dashboard scene.
 *
 * Receives ServerMessages from the collab ops channel, extracts the wrapped
 * CollabOperation, and applies it via DashboardMutationClient.execute().
 * Sets the suppression flag around application to prevent the opExtractor
 * from re-broadcasting the change as a new local edit (echo loop prevention).
 *
 * Unknown mutation types are logged and silently ignored for forward
 * compatibility — a newer server may emit types this client doesn't support yet.
 */

import type { DashboardMutationClient } from 'app/features/dashboard-scene/mutation-api/DashboardMutationClient';

import { suppressExtraction, unsuppressExtraction } from './opExtractor';
import type { CollabOperation, ServerMessage } from './protocol/messages';

export interface ApplyResult {
  applied: boolean;
  error?: string;
}

/**
 * Apply a remote ServerMessage to the local scene.
 *
 * Only messages with `kind: 'op'` are processed. Lock, checkpoint, and
 * presence messages are returned as not-applied (handled elsewhere).
 */
export async function applyRemoteOp(
  msg: ServerMessage,
  client: DashboardMutationClient,
  localUserId: string
): Promise<ApplyResult> {
  // Only handle op messages — lock/checkpoint/presence handled by other subsystems
  if (msg.kind !== 'op') {
    return { applied: false };
  }

  // Skip our own ops — they were already applied locally when the user made the edit
  if (msg.userId === localUserId) {
    return { applied: false };
  }

  const collabOp = msg.op as CollabOperation | null;
  if (!collabOp?.mutation) {
    return { applied: false, error: 'ServerMessage op payload missing mutation field' };
  }

  const { type, payload } = collabOp.mutation;

  // Forward compatibility: unknown types are logged but not treated as errors
  const available = client.getAvailableCommands();
  if (!available.includes(type.toUpperCase())) {
    console.warn(`[collab] Ignoring unknown mutation type from remote: "${type}"`);
    return { applied: false };
  }

  // Suppress extraction so the opExtractor doesn't re-broadcast this as a local edit
  suppressExtraction();
  try {
    const result = await client.execute({ type, payload });
    if (!result.success) {
      return { applied: false, error: result.error };
    }
    return { applied: true };
  } finally {
    unsuppressExtraction();
  }
}
