/**
 * Redux middleware for CRDT operations
 *
 * This middleware intercepts actions that modify state and:
 * 1. Broadcasts pending operations to the WebSocket channel
 * 2. Handles incoming remote operations
 * 3. Manages operation queue and deduplication
 */

import { Middleware } from '@reduxjs/toolkit';
import { CRDTOperation } from '../crdt/types';
import { selectPendingOperations } from './selectors';
import { clearPendingOperations } from './crdtSlice';

export interface OperationBroadcaster {
  /**
   * Broadcast an operation to other clients
   */
  broadcast(operation: CRDTOperation): void;

  /**
   * Broadcast multiple operations
   */
  broadcastBatch(operations: CRDTOperation[]): void;

  /**
   * Subscribe to incoming operations
   */
  subscribe(handler: (operation: CRDTOperation) => void): () => void;
}

/**
 * Create CRDT operation middleware
 *
 * @param broadcaster - Interface for broadcasting operations (WebSocket, etc.)
 */
export function createOperationMiddleware(
  broadcaster?: OperationBroadcaster
): Middleware {
  return (store) => (next) => (action) => {
    // Apply action first
    const result = next(action);

    // After state update, check for pending operations to broadcast
    if (broadcaster && shouldBroadcast((action as any).type)) {
      const state = store.getState().exploreMapCRDT;
      const pendingOps = selectPendingOperations(state);

      if (pendingOps.length > 0) {
        // Broadcast all pending operations
        for (const op of pendingOps) {
          try {
            broadcaster.broadcast(op);
          } catch (error) {
            console.error('Failed to broadcast operation:', error);
          }
        }

        // Clear pending operations after successful broadcast
        store.dispatch(clearPendingOperations());
      }
    }

    return result;
  };
}

/**
 * Determine if an action should trigger broadcasting
 */
function shouldBroadcast(actionType: string): boolean {
  const broadcastableActions = [
    'exploreMapCRDT/addPanel',
    'exploreMapCRDT/removePanel',
    'exploreMapCRDT/updatePanelPosition',
    'exploreMapCRDT/updatePanelSize',
    'exploreMapCRDT/bringPanelToFront',
    'exploreMapCRDT/savePanelExploreState',
    'exploreMapCRDT/updateMapTitle',
    'exploreMapCRDT/duplicatePanel',
  ];

  return broadcastableActions.includes(actionType);
}

/**
 * Mock broadcaster for testing without WebSocket
 */
export class MockBroadcaster implements OperationBroadcaster {
  private handlers: Array<(operation: CRDTOperation) => void> = [];
  public broadcastedOperations: CRDTOperation[] = [];

  broadcast(operation: CRDTOperation): void {
    this.broadcastedOperations.push(operation);
  }

  broadcastBatch(operations: CRDTOperation[]): void {
    this.broadcastedOperations.push(...operations);
  }

  subscribe(handler: (operation: CRDTOperation) => void): () => void {
    this.handlers.push(handler);

    // Return unsubscribe function
    return () => {
      const index = this.handlers.indexOf(handler);
      if (index > -1) {
        this.handlers.splice(index, 1);
      }
    };
  }

  /**
   * Simulate receiving a remote operation
   */
  simulateRemoteOperation(operation: CRDTOperation): void {
    for (const handler of this.handlers) {
      handler(operation);
    }
  }

  /**
   * Clear broadcasted operations history
   */
  clear(): void {
    this.broadcastedOperations = [];
  }
}

/**
 * Throttle helper for rate-limiting broadcasts
 */
export class ThrottledBroadcaster implements OperationBroadcaster {
  private broadcaster: OperationBroadcaster;
  private throttleMs: number;
  private pendingBatch: CRDTOperation[] = [];
  private timeoutId?: ReturnType<typeof setTimeout>;

  constructor(broadcaster: OperationBroadcaster, throttleMs: number = 100) {
    this.broadcaster = broadcaster;
    this.throttleMs = throttleMs;
  }

  broadcast(operation: CRDTOperation): void {
    this.pendingBatch.push(operation);

    if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => {
        this.flush();
      }, this.throttleMs);
    }
  }

  broadcastBatch(operations: CRDTOperation[]): void {
    this.pendingBatch.push(...operations);

    if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => {
        this.flush();
      }, this.throttleMs);
    }
  }

  subscribe(handler: (operation: CRDTOperation) => void): () => void {
    return this.broadcaster.subscribe(handler);
  }

  private flush(): void {
    if (this.pendingBatch.length > 0) {
      this.broadcaster.broadcastBatch([...this.pendingBatch]);
      this.pendingBatch = [];
    }
    this.timeoutId = undefined;
  }

  /**
   * Immediately flush any pending operations
   */
  flushNow(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = undefined;
    }
    this.flush();
  }
}

/**
 * Buffered broadcaster for offline support
 * Buffers operations when offline and replays when back online
 */
export class BufferedBroadcaster implements OperationBroadcaster {
  private broadcaster: OperationBroadcaster;
  private buffer: CRDTOperation[] = [];
  private isOnline: boolean = true;
  private maxBufferSize: number;

  constructor(broadcaster: OperationBroadcaster, maxBufferSize: number = 1000) {
    this.broadcaster = broadcaster;
    this.maxBufferSize = maxBufferSize;
  }

  broadcast(operation: CRDTOperation): void {
    if (this.isOnline) {
      this.broadcaster.broadcast(operation);
    } else {
      this.bufferOperation(operation);
    }
  }

  broadcastBatch(operations: CRDTOperation[]): void {
    if (this.isOnline) {
      this.broadcaster.broadcastBatch(operations);
    } else {
      operations.forEach((op) => this.bufferOperation(op));
    }
  }

  subscribe(handler: (operation: CRDTOperation) => void): () => void {
    return this.broadcaster.subscribe(handler);
  }

  private bufferOperation(operation: CRDTOperation): void {
    this.buffer.push(operation);

    // Limit buffer size
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift(); // Remove oldest
    }
  }

  /**
   * Set online status
   * When going online, replays buffered operations
   */
  setOnline(online: boolean): void {
    const wasOffline = !this.isOnline;
    this.isOnline = online;

    if (online && wasOffline && this.buffer.length > 0) {
      // Replay buffered operations
      this.broadcaster.broadcastBatch([...this.buffer]);
      this.buffer = [];
    }
  }

  /**
   * Get current buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }

  /**
   * Clear buffer
   */
  clearBuffer(): void {
    this.buffer = [];
  }
}
