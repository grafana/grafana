/**
 * Operation Queue for CRDT operations
 *
 * Manages local and remote operations, ensuring they are applied in causal order.
 * Handles deduplication, ordering, and buffering of out-of-order operations.
 */

import { HybridLogicalClock, compareHLC, HLCTimestamp } from '../crdt/hlc';
import { CRDTOperation } from '../crdt/types';

export interface QueuedOperation {
  operation: CRDTOperation;
  source: 'local' | 'remote';
  enqueuedAt: number;  // Timestamp when added to queue
}

export interface OperationQueueStats {
  pendingCount: number;
  appliedCount: number;
  localCount: number;
  remoteCount: number;
}

/**
 * Operation queue that maintains causal ordering of CRDT operations
 */
export class OperationQueue {
  private clock: HybridLogicalClock;
  private nodeId: string;

  // Operations waiting to be applied (sorted by HLC timestamp)
  private pendingQueue: QueuedOperation[] = [];

  // Set of operation IDs that have been applied (for deduplication)
  private appliedOperations: Set<string> = new Set();

  // Maximum number of applied operation IDs to keep in memory
  private readonly maxAppliedHistorySize = 10000;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
    this.clock = new HybridLogicalClock(nodeId);
  }

  /**
   * Get the current node ID
   */
  getNodeId(): string {
    return this.nodeId;
  }

  /**
   * Get the current HLC
   */
  getClock(): HybridLogicalClock {
    return this.clock;
  }

  /**
   * Add a local operation to the queue
   * Automatically assigns a new timestamp from the local clock
   */
  addLocalOperation(operation: CRDTOperation): CRDTOperation {
    // Tick clock for new local event
    const timestamp = this.clock.tick();

    // Create operation with new timestamp
    const timedOperation: CRDTOperation = {
      ...operation,
      timestamp,
      nodeId: this.nodeId,
    };

    // Add to pending queue
    this.enqueueOperation(timedOperation, 'local');

    return timedOperation;
  }

  /**
   * Add a remote operation to the queue
   * Updates local clock based on received timestamp
   */
  addRemoteOperation(operation: CRDTOperation): boolean {
    // Check if already applied (deduplication)
    if (this.appliedOperations.has(operation.operationId)) {
      return false; // Already applied, ignore
    }

    // Check if already in pending queue
    if (this.pendingQueue.some((q) => q.operation.operationId === operation.operationId)) {
      return false; // Already queued, ignore
    }

    // Update clock with received timestamp
    this.clock.update(operation.timestamp);

    // Add to pending queue
    this.enqueueOperation(operation, 'remote');

    return true;
  }

  /**
   * Internal method to enqueue an operation and maintain sorted order
   */
  private enqueueOperation(operation: CRDTOperation, source: 'local' | 'remote'): void {
    const queued: QueuedOperation = {
      operation,
      source,
      enqueuedAt: Date.now(),
    };

    // Insert in sorted order by HLC timestamp
    const insertIndex = this.findInsertIndex(operation.timestamp);
    this.pendingQueue.splice(insertIndex, 0, queued);
  }

  /**
   * Binary search to find insertion index for maintaining sorted order
   */
  private findInsertIndex(timestamp: HLCTimestamp): number {
    let left = 0;
    let right = this.pendingQueue.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const comparison = compareHLC(this.pendingQueue[mid].operation.timestamp, timestamp);

      if (comparison < 0) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left;
  }

  /**
   * Dequeue the next operation to apply
   * Returns undefined if queue is empty
   */
  dequeue(): CRDTOperation | undefined {
    const queued = this.pendingQueue.shift();
    if (!queued) {
      return undefined;
    }

    // Mark as applied
    this.markApplied(queued.operation.operationId);

    return queued.operation;
  }

  /**
   * Peek at the next operation without removing it
   */
  peek(): CRDTOperation | undefined {
    return this.pendingQueue[0]?.operation;
  }

  /**
   * Get all pending operations (without removing them)
   */
  getPendingOperations(): CRDTOperation[] {
    return this.pendingQueue.map((q) => q.operation);
  }

  /**
   * Check if an operation has been applied
   */
  hasApplied(operationId: string): boolean {
    return this.appliedOperations.has(operationId);
  }

  /**
   * Mark an operation as applied
   */
  markApplied(operationId: string): void {
    this.appliedOperations.add(operationId);

    // Limit memory usage by removing old entries
    if (this.appliedOperations.size > this.maxAppliedHistorySize) {
      this.pruneAppliedHistory();
    }
  }

  /**
   * Prune old entries from applied operations set
   * Removes the oldest 10% of entries
   */
  private pruneAppliedHistory(): void {
    const toRemove = Math.floor(this.maxAppliedHistorySize * 0.1);
    const entries = Array.from(this.appliedOperations);

    // Remove first 10% (oldest)
    for (let i = 0; i < toRemove && i < entries.length; i++) {
      this.appliedOperations.delete(entries[i]);
    }
  }

  /**
   * Get the number of pending operations
   */
  getPendingCount(): number {
    return this.pendingQueue.length;
  }

  /**
   * Check if queue is empty
   */
  isEmpty(): boolean {
    return this.pendingQueue.length === 0;
  }

  /**
   * Clear all pending operations (useful for testing/reset)
   */
  clearPending(): void {
    this.pendingQueue = [];
  }

  /**
   * Clear applied operations history
   */
  clearApplied(): void {
    this.appliedOperations.clear();
  }

  /**
   * Get queue statistics
   */
  getStats(): OperationQueueStats {
    const localCount = this.pendingQueue.filter((q) => q.source === 'local').length;
    const remoteCount = this.pendingQueue.filter((q) => q.source === 'remote').length;

    return {
      pendingCount: this.pendingQueue.length,
      appliedCount: this.appliedOperations.size,
      localCount,
      remoteCount,
    };
  }

  /**
   * Drain all operations from the queue in order
   * Returns array of operations in causal order
   */
  drainAll(): CRDTOperation[] {
    const operations: CRDTOperation[] = [];

    while (!this.isEmpty()) {
      const op = this.dequeue();
      if (op) {
        operations.push(op);
      }
    }

    return operations;
  }

  /**
   * Get operations older than a certain age (in milliseconds)
   * Useful for detecting stale operations
   */
  getStaleOperations(maxAge: number): CRDTOperation[] {
    const now = Date.now();
    return this.pendingQueue
      .filter((q) => now - q.enqueuedAt > maxAge)
      .map((q) => q.operation);
  }

  /**
   * Remove specific operations by ID
   * Returns number of operations removed
   */
  removeOperations(operationIds: string[]): number {
    const idsToRemove = new Set(operationIds);
    const initialLength = this.pendingQueue.length;

    this.pendingQueue = this.pendingQueue.filter(
      (q) => !idsToRemove.has(q.operation.operationId)
    );

    return initialLength - this.pendingQueue.length;
  }
}
