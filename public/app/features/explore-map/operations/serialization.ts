/**
 * Operation serialization utilities
 *
 * Handles serialization/deserialization of CRDT operations for network transmission
 * and storage. Supports both JSON and potential future binary formats.
 */

import { CRDTOperation } from '../crdt/types';

/**
 * Serialize an operation to JSON string
 */
export function serializeOperation(operation: CRDTOperation): string {
  return JSON.stringify(operation);
}

/**
 * Deserialize an operation from JSON string
 */
export function deserializeOperation(json: string): CRDTOperation {
  return JSON.parse(json);
}

/**
 * Serialize multiple operations to JSON string
 */
export function serializeOperations(operations: CRDTOperation[]): string {
  return JSON.stringify(operations);
}

/**
 * Deserialize multiple operations from JSON string
 */
export function deserializeOperations(json: string): CRDTOperation[] {
  return JSON.parse(json);
}

/**
 * Serialize operation for WebSocket transmission
 * Adds metadata for efficient routing
 */
export interface WebSocketMessage {
  type: 'operation' | 'batch' | 'sync-request' | 'sync-response';
  mapUid: string;
  data: CRDTOperation | CRDTOperation[];
  timestamp: number; // Message sent timestamp
}

export function serializeForWebSocket(
  operation: CRDTOperation | CRDTOperation[]
): string {
  const operations = Array.isArray(operation) ? operation : [operation];
  const mapUid = operations[0]?.mapUid || '';

  const message: WebSocketMessage = {
    type: Array.isArray(operation) ? 'batch' : 'operation',
    mapUid,
    data: operation,
    timestamp: Date.now(),
  };

  return JSON.stringify(message);
}

export function deserializeFromWebSocket(json: string): WebSocketMessage {
  return JSON.parse(json);
}

/**
 * Compress operation by removing redundant data
 * Useful for bandwidth optimization
 */
export function compressOperation(operation: CRDTOperation): any {
  // Remove verbose field names, use short aliases
  const compressed: any = {
    t: operation.type,
    i: operation.operationId,
    m: operation.mapUid,
    n: operation.nodeId,
    ts: {
      l: operation.timestamp.logicalTime,
      w: operation.timestamp.wallTime,
      n: operation.timestamp.nodeId,
    },
    p: compressPayload(operation),
  };

  return compressed;
}

function compressPayload(operation: CRDTOperation): any {
  const payload = (operation as any).payload;
  if (!payload) {
    return undefined;
  }

  // Type-specific compression
  switch (operation.type) {
    case 'add-panel':
      return {
        pi: payload.panelId,
        ei: payload.exploreId,
        pos: {
          x: payload.position.x,
          y: payload.position.y,
          w: payload.position.width,
          h: payload.position.height,
        },
      };

    case 'remove-panel':
      return {
        pi: payload.panelId,
        t: payload.observedTags,
      };

    case 'update-panel-position':
      return {
        pi: payload.panelId,
        x: payload.x,
        y: payload.y,
      };

    case 'update-panel-size':
      return {
        pi: payload.panelId,
        w: payload.width,
        h: payload.height,
      };

    case 'update-panel-zindex':
      return {
        pi: payload.panelId,
        z: payload.zIndex,
      };

    case 'update-panel-explore-state':
      return {
        pi: payload.panelId,
        es: payload.exploreState,
      };

    case 'update-title':
      return {
        t: payload.title,
      };

    case 'batch':
      return {
        ops: payload.operations.map(compressOperation),
      };

    default:
      return payload;
  }
}

/**
 * Decompress operation from compressed format
 */
export function decompressOperation(compressed: any): CRDTOperation {
  const base = {
    type: compressed.t,
    operationId: compressed.i,
    mapUid: compressed.m,
    nodeId: compressed.n,
    timestamp: {
      logicalTime: compressed.ts.l,
      wallTime: compressed.ts.w,
      nodeId: compressed.ts.n,
    },
  };

  const payload = decompressPayload(compressed.t, compressed.p);

  return {
    ...base,
    payload,
  } as CRDTOperation;
}

function decompressPayload(type: string, compressed: any): any {
  if (!compressed) {
    return undefined;
  }

  switch (type) {
    case 'add-panel':
      return {
        panelId: compressed.pi,
        exploreId: compressed.ei,
        position: {
          x: compressed.pos.x,
          y: compressed.pos.y,
          width: compressed.pos.w,
          height: compressed.pos.h,
        },
      };

    case 'remove-panel':
      return {
        panelId: compressed.pi,
        observedTags: compressed.t,
      };

    case 'update-panel-position':
      return {
        panelId: compressed.pi,
        x: compressed.x,
        y: compressed.y,
      };

    case 'update-panel-size':
      return {
        panelId: compressed.pi,
        width: compressed.w,
        height: compressed.h,
      };

    case 'update-panel-zindex':
      return {
        panelId: compressed.pi,
        zIndex: compressed.z,
      };

    case 'update-panel-explore-state':
      return {
        panelId: compressed.pi,
        exploreState: compressed.es,
      };

    case 'update-title':
      return {
        title: compressed.t,
      };

    case 'batch':
      return {
        operations: compressed.ops.map(decompressOperation),
      };

    default:
      return compressed;
  }
}

/**
 * Calculate approximate size of an operation in bytes
 * Useful for monitoring bandwidth usage
 */
export function estimateOperationSize(operation: CRDTOperation): number {
  const json = serializeOperation(operation);
  // Approximate UTF-8 byte length (not exact, but close enough)
  return new Blob([json]).size;
}

/**
 * Batch multiple operations into a single message
 * Useful for reducing WebSocket message overhead
 */
export function batchOperations(
  operations: CRDTOperation[],
  maxBatchSize: number = 10
): CRDTOperation[][] {
  const batches: CRDTOperation[][] = [];

  for (let i = 0; i < operations.length; i += maxBatchSize) {
    batches.push(operations.slice(i, i + maxBatchSize));
  }

  return batches;
}

/**
 * Deduplicate operations by operation ID
 * Keeps the first occurrence of each unique operation ID
 */
export function deduplicateOperations(operations: CRDTOperation[]): CRDTOperation[] {
  const seen = new Set<string>();
  const deduplicated: CRDTOperation[] = [];

  for (const operation of operations) {
    if (!seen.has(operation.operationId)) {
      seen.add(operation.operationId);
      deduplicated.push(operation);
    }
  }

  return deduplicated;
}
