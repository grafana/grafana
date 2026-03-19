/**
 * CollabMutationClient — wraps DashboardMutationClient to broadcast
 * successful write mutations as CollabOperations over the collab channel.
 *
 * Read-only commands (LIST_PANELS, LIST_VARIABLES, GET_LAYOUT, GET_DASHBOARD_INFO)
 * pass through without broadcasting.
 */

import type { MutationClient, MutationRequest, MutationResult } from 'app/features/dashboard-scene/mutation-api/types';

import { debugLog } from './debugLog';
import { getLockTarget } from './lockTargetMapping';
import { suppressExtraction, unsuppressExtraction } from './opExtractor';
import type { ClientMessage, CollabOperation } from './protocol/messages';

/** Commands that only read state — never broadcast. */
const READ_ONLY_COMMANDS = new Set(['LIST_PANELS', 'LIST_VARIABLES', 'GET_LAYOUT', 'GET_DASHBOARD_INFO']);

export type PublishOp = (msg: ClientMessage) => void;

export class CollabMutationClient implements MutationClient {
  private inner: MutationClient;
  private publishOp: PublishOp;
  private localUserId: string;

  /** When true, execute() skips broadcasting (used by opApplicator for remote ops). */
  private _remoteApply = false;

  constructor(inner: MutationClient, publishOp: PublishOp, localUserId: string) {
    this.inner = inner;
    this.publishOp = publishOp;
    this.localUserId = localUserId;
  }

  /** Set before applying a remote op to prevent re-broadcasting (echo loop). */
  setRemoteApply(value: boolean): void {
    this._remoteApply = value;
  }

  async execute(mutation: MutationRequest): Promise<MutationResult> {
    const type = mutation.type.toUpperCase();
    const isWrite = !READ_ONLY_COMMANDS.has(type);

    // Suppress opExtractor for write mutations routed through this client.
    // The CollabMutationClient broadcasts the op itself after a successful write,
    // so opExtractor must not also emit from the resulting scene state change.
    if (isWrite && !this._remoteApply) {
      suppressExtraction();
    }

    let result: MutationResult;
    try {
      result = await this.inner.execute(mutation);
    } finally {
      if (isWrite && !this._remoteApply) {
        // Defer unsuppression to the next microtask so that any scene state
        // change events triggered by forceRender() settle before opExtractor
        // is re-enabled. This prevents the extractor from picking up the
        // state change that *this* client already broadcasts explicitly.
        queueMicrotask(() => unsuppressExtraction());
      }
    }

    // Don't broadcast read-only commands, failed mutations, or remote applies
    if (!result.success || !isWrite || this._remoteApply) {
      return result;
    }

    const lockTarget = getLockTarget(mutation);

    const collabOp: CollabOperation = {
      mutation: { type, payload: mutation.payload },
      lockTarget,
    };

    const msg: ClientMessage = {
      kind: 'op',
      op: {
        ...collabOp,
        userId: this.localUserId,
      },
    };

    debugLog('CollabMutationClient broadcasting', { type, lockTarget });
    this.publishOp(msg);

    return result;
  }

  getAvailableCommands(): string[] {
    return this.inner.getAvailableCommands();
  }
}
