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

import type { MutationClient } from 'app/features/dashboard-scene/mutation-api/types';

import { CollabMutationClient } from './CollabMutationClient';
import { debugLog } from './debugLog';
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
  client: MutationClient,
  localUserId: string,
  resolvedUserId?: string
): Promise<ApplyResult> {
  // Only handle op messages — lock/checkpoint/presence handled by other subsystems
  if (msg.kind !== 'op') {
    return { applied: false };
  }

  // Skip our own ops — they were already applied locally when the user made the edit
  const userId = resolvedUserId ?? msg.userId;
  if (userId === localUserId) {
    debugLog('Skipping own op', { userId, seq: msg.seq });
    return { applied: false };
  }

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const collabOp = msg.op as CollabOperation | null;
  if (!collabOp?.mutation) {
    debugLog('Op missing mutation field', { userId: msg.userId, seq: msg.seq });
    return { applied: false, error: 'ServerMessage op payload missing mutation field' };
  }

  const { type, payload } = collabOp.mutation;
  debugLog('Remote op received', { type, seq: msg.seq, userId: msg.userId });

  // Forward compatibility: unknown types are logged but not treated as errors
  const available = client.getAvailableCommands();
  if (!available.includes(type.toUpperCase())) {
    debugLog('Ignoring unknown mutation type', { type });
    console.warn(`[collab] Ignoring unknown mutation type from remote: "${type}"`);
    return { applied: false };
  }

  // Suppress extraction so the opExtractor doesn't re-broadcast this as a local edit
  debugLog('Suppression flag toggled on');
  suppressExtraction();

  // If the client is a CollabMutationClient wrapper, set remoteApply to prevent
  // the wrapper from re-broadcasting this remote op (echo loop prevention).
  const isCollabClient = client instanceof CollabMutationClient;
  if (isCollabClient) {
    client.setRemoteApply(true);
  }

  try {
    const result = await client.execute({ type, payload });
    if (!result.success) {
      debugLog('Op application failed', { type, error: result.error });
      return { applied: false, error: result.error };
    }
    debugLog('Op applied successfully', { type, seq: msg.seq });
    return { applied: true };
  } finally {
    if (isCollabClient) {
      client.setRemoteApply(false);
    }
    debugLog('Suppression flag toggled off');
    unsuppressExtraction();
  }
}
