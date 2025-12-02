/**
 * Operation validators
 *
 * Validates CRDT operations for correctness, security, and schema compliance.
 */

import { CRDTOperation } from '../crdt/types';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ValidationOptions {
  maxPanelSize?: { width: number; height: number };
  minPanelSize?: { width: number; height: number };
  maxTitleLength?: number;
  allowNegativeCoordinates?: boolean;
  maxCoordinate?: number;
}

const DEFAULT_OPTIONS: Required<ValidationOptions> = {
  maxPanelSize: { width: 5000, height: 5000 },
  minPanelSize: { width: 100, height: 100 },
  maxTitleLength: 255,
  allowNegativeCoordinates: false,
  maxCoordinate: 20000,
};

/**
 * Validate a CRDT operation
 */
export function validateOperation(
  operation: CRDTOperation,
  options: ValidationOptions = {}
): ValidationResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const errors: string[] = [];

  // Validate common fields
  if (!operation.operationId || typeof operation.operationId !== 'string') {
    errors.push('Operation ID is required and must be a string');
  }

  if (!operation.mapUid || typeof operation.mapUid !== 'string') {
    errors.push('Map UID is required and must be a string');
  }

  if (!operation.nodeId || typeof operation.nodeId !== 'string') {
    errors.push('Node ID is required and must be a string');
  }

  if (!operation.timestamp) {
    errors.push('Timestamp is required');
  } else {
    validateTimestamp(operation.timestamp, errors);
  }

  // Validate type-specific fields
  switch (operation.type) {
    case 'add-panel':
      validateAddPanel(operation, opts, errors);
      break;
    case 'remove-panel':
      validateRemovePanel(operation, errors);
      break;
    case 'update-panel-position':
      validateUpdatePanelPosition(operation, opts, errors);
      break;
    case 'update-panel-size':
      validateUpdatePanelSize(operation, opts, errors);
      break;
    case 'update-panel-zindex':
      validateUpdatePanelZIndex(operation, errors);
      break;
    case 'update-panel-explore-state':
      validateUpdatePanelExploreState(operation, errors);
      break;
    case 'update-title':
      validateUpdateTitle(operation, opts, errors);
      break;
    case 'add-comment':
      validateAddComment(operation, opts, errors);
      break;
    case 'remove-comment':
      validateRemoveComment(operation, opts, errors);
      break;
    case 'batch':
      validateBatchOperation(operation, opts, errors);
      break;
    default:
      errors.push(`Unknown operation type: ${(operation as any).type}`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

function validateTimestamp(timestamp: any, errors: string[]): void {
  if (typeof timestamp !== 'object' || timestamp === null) {
    errors.push('Timestamp must be an object');
    return;
  }

  if (typeof timestamp.logicalTime !== 'number' || timestamp.logicalTime < 0) {
    errors.push('Timestamp logical time must be a non-negative number');
  }

  if (typeof timestamp.wallTime !== 'number' || timestamp.wallTime < 0) {
    errors.push('Timestamp wall time must be a non-negative number');
  }

  if (typeof timestamp.nodeId !== 'string' || !timestamp.nodeId) {
    errors.push('Timestamp node ID must be a non-empty string');
  }

  // Check for reasonable wall time (not too far in future)
  const now = Date.now();
  const maxFutureOffset = 60000; // 1 minute
  if (timestamp.wallTime > now + maxFutureOffset) {
    errors.push('Timestamp wall time is too far in the future');
  }
}

function validateAddPanel(operation: any, opts: Required<ValidationOptions>, errors: string[]): void {
  if (!operation.payload) {
    errors.push('Add panel operation requires payload');
    return;
  }

  const { panelId, exploreId, position } = operation.payload;

  if (!panelId || typeof panelId !== 'string') {
    errors.push('Panel ID is required and must be a string');
  }

  if (!exploreId || typeof exploreId !== 'string') {
    errors.push('Explore ID is required and must be a string');
  }

  if (!position || typeof position !== 'object') {
    errors.push('Position is required and must be an object');
    return;
  }

  validatePosition(position, opts, errors);
}

function validateRemovePanel(operation: any, errors: string[]): void {
  if (!operation.payload) {
    errors.push('Remove panel operation requires payload');
    return;
  }

  const { panelId, observedTags } = operation.payload;

  if (!panelId || typeof panelId !== 'string') {
    errors.push('Panel ID is required and must be a string');
  }

  if (!Array.isArray(observedTags)) {
    errors.push('Observed tags must be an array');
  } else if (observedTags.some((tag) => typeof tag !== 'string')) {
    errors.push('All observed tags must be strings');
  }
}

function validateUpdatePanelPosition(
  operation: any,
  opts: Required<ValidationOptions>,
  errors: string[]
): void {
  if (!operation.payload) {
    errors.push('Update panel position operation requires payload');
    return;
  }

  const { panelId, x, y } = operation.payload;

  if (!panelId || typeof panelId !== 'string') {
    errors.push('Panel ID is required and must be a string');
  }

  if (typeof x !== 'number') {
    errors.push('X coordinate must be a number');
  } else {
    validateCoordinate('x', x, opts, errors);
  }

  if (typeof y !== 'number') {
    errors.push('Y coordinate must be a number');
  } else {
    validateCoordinate('y', y, opts, errors);
  }
}

function validateUpdatePanelSize(
  operation: any,
  opts: Required<ValidationOptions>,
  errors: string[]
): void {
  if (!operation.payload) {
    errors.push('Update panel size operation requires payload');
    return;
  }

  const { panelId, width, height } = operation.payload;

  if (!panelId || typeof panelId !== 'string') {
    errors.push('Panel ID is required and must be a string');
  }

  if (typeof width !== 'number') {
    errors.push('Width must be a number');
  } else {
    validateDimension('width', width, opts, errors);
  }

  if (typeof height !== 'number') {
    errors.push('Height must be a number');
  } else {
    validateDimension('height', height, opts, errors);
  }
}

function validateUpdatePanelZIndex(operation: any, errors: string[]): void {
  if (!operation.payload) {
    errors.push('Update panel z-index operation requires payload');
    return;
  }

  const { panelId, zIndex } = operation.payload;

  if (!panelId || typeof panelId !== 'string') {
    errors.push('Panel ID is required and must be a string');
  }

  if (typeof zIndex !== 'number' || zIndex < 0) {
    errors.push('Z-index must be a non-negative number');
  }
}

function validateUpdatePanelExploreState(operation: any, errors: string[]): void {
  if (!operation.payload) {
    errors.push('Update panel explore state operation requires payload');
    return;
  }

  const { panelId, exploreState } = operation.payload;

  if (!panelId || typeof panelId !== 'string') {
    errors.push('Panel ID is required and must be a string');
  }

  // exploreState can be undefined, but if present must be an object
  if (exploreState !== undefined && (typeof exploreState !== 'object' || exploreState === null)) {
    errors.push('Explore state must be an object or undefined');
  }
}

function validateUpdateTitle(operation: any, opts: Required<ValidationOptions>, errors: string[]): void {
  if (!operation.payload) {
    errors.push('Update title operation requires payload');
    return;
  }

  const { title } = operation.payload;

  if (typeof title !== 'string') {
    errors.push('Title must be a string');
  } else if (title.length > opts.maxTitleLength) {
    errors.push(`Title exceeds maximum length of ${opts.maxTitleLength} characters`);
  }
}

function validateAddComment(operation: any, opts: Required<ValidationOptions>, errors: string[]): void {
  if (!operation.payload) {
    errors.push('Add comment operation requires payload');
    return;
  }

  const { commentId, comment } = operation.payload;

  if (!commentId || typeof commentId !== 'string') {
    errors.push('Comment ID is required and must be a string');
  }

  if (!comment || typeof comment !== 'object') {
    errors.push('Comment must be an object');
    return;
  }

  if (typeof comment.text !== 'string') {
    errors.push('Comment text must be a string');
  }
  if (typeof comment.username !== 'string') {
    errors.push('Comment username must be a string');
  }
  if (typeof comment.timestamp !== 'number') {
    errors.push('Comment timestamp must be a number');
  }

  // Comments can be longer than titles, so we use a higher limit
  // Using 10x the title limit for comments
  const maxCommentLength = opts.maxTitleLength * 10;
  if (comment.text && comment.text.length > maxCommentLength) {
    errors.push(`Comment text exceeds maximum length of ${maxCommentLength} characters`);
  }
}

function validateRemoveComment(operation: any, opts: Required<ValidationOptions>, errors: string[]): void {
  if (!operation.payload) {
    errors.push('Remove comment operation requires payload');
    return;
  }

  const { commentId, observedTags } = operation.payload;

  if (!commentId || typeof commentId !== 'string') {
    errors.push('Comment ID is required and must be a string');
  }

  if (!Array.isArray(observedTags)) {
    errors.push('Observed tags must be an array');
  }
}

function validateBatchOperation(operation: any, opts: Required<ValidationOptions>, errors: string[]): void {
  if (!operation.payload) {
    errors.push('Batch operation requires payload');
    return;
  }

  const { operations } = operation.payload;

  if (!Array.isArray(operations)) {
    errors.push('Batch operations must be an array');
    return;
  }

  if (operations.length === 0) {
    errors.push('Batch operation cannot be empty');
  }

  // Validate each sub-operation
  operations.forEach((subOp: any, index: number) => {
    const result = validateOperation(subOp, opts);
    if (!result.valid) {
      errors.push(`Batch operation[${index}]: ${result.errors.join(', ')}`);
    }
  });
}

function validatePosition(
  position: any,
  opts: Required<ValidationOptions>,
  errors: string[]
): void {
  const { x, y, width, height } = position;

  if (typeof x !== 'number') {
    errors.push('Position x must be a number');
  } else {
    validateCoordinate('x', x, opts, errors);
  }

  if (typeof y !== 'number') {
    errors.push('Position y must be a number');
  } else {
    validateCoordinate('y', y, opts, errors);
  }

  if (typeof width !== 'number') {
    errors.push('Position width must be a number');
  } else {
    validateDimension('width', width, opts, errors);
  }

  if (typeof height !== 'number') {
    errors.push('Position height must be a number');
  } else {
    validateDimension('height', height, opts, errors);
  }
}

function validateCoordinate(
  name: string,
  value: number,
  opts: Required<ValidationOptions>,
  errors: string[]
): void {
  if (!Number.isFinite(value)) {
    errors.push(`${name} must be a finite number`);
    return;
  }

  if (!opts.allowNegativeCoordinates && value < 0) {
    errors.push(`${name} cannot be negative`);
  }

  if (Math.abs(value) > opts.maxCoordinate) {
    errors.push(`${name} exceeds maximum coordinate value of ${opts.maxCoordinate}`);
  }
}

function validateDimension(
  name: string,
  value: number,
  opts: Required<ValidationOptions>,
  errors: string[]
): void {
  if (!Number.isFinite(value)) {
    errors.push(`${name} must be a finite number`);
    return;
  }

  const minSize = name === 'width' ? opts.minPanelSize.width : opts.minPanelSize.height;
  const maxSize = name === 'width' ? opts.maxPanelSize.width : opts.maxPanelSize.height;

  if (value < minSize) {
    errors.push(`${name} must be at least ${minSize}`);
  }

  if (value > maxSize) {
    errors.push(`${name} cannot exceed ${maxSize}`);
  }
}

/**
 * Quick validation that only checks critical fields
 * Useful for performance-sensitive paths
 */
export function quickValidate(operation: CRDTOperation): boolean {
  return !!(
    operation.operationId &&
    operation.mapUid &&
    operation.nodeId &&
    operation.timestamp &&
    operation.type
  );
}
