/**
 * Operations module exports
 *
 * CRDT operation management: queue, validation, creation, serialization
 */

// Operation queue
export { OperationQueue } from './queue';
export type { QueuedOperation, OperationQueueStats } from './queue';

// Validators
export { validateOperation, quickValidate } from './validators';
export type { ValidationResult, ValidationOptions } from './validators';

// Operation creators
export {
  createAddPanelOperation,
  createRemovePanelOperation,
  createUpdatePanelPositionOperation,
  createUpdatePanelSizeOperation,
  createUpdatePanelZIndexOperation,
  createUpdatePanelExploreStateOperation,
  createUpdateTitleOperation,
  createAddCommentOperation,
  createRemoveCommentOperation,
  createBatchOperation,
  createMultiPanelMoveOperation,
  createDuplicatePanelOperation,
} from './creators';

// Serialization
export {
  serializeOperation,
  deserializeOperation,
  serializeOperations,
  deserializeOperations,
  serializeForWebSocket,
  deserializeFromWebSocket,
  compressOperation,
  decompressOperation,
  estimateOperationSize,
  batchOperations,
  deduplicateOperations,
} from './serialization';
export type { WebSocketMessage } from './serialization';
