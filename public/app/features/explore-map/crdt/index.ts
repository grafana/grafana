/**
 * CRDT module exports
 *
 * Conflict-Free Replicated Data Types for collaborative Explore Map editing
 */

// Core CRDT types
export { HybridLogicalClock, compareHLC, happensBefore, happensAfter, timestampEquals, maxTimestamp } from './hlc';
export type { HLCTimestamp } from './hlc';

export { ORSet } from './orset';
export type { ORSetJSON } from './orset';

export { LWWRegister, createLWWRegister } from './lwwregister';
export type { LWWRegisterJSON } from './lwwregister';

export { PNCounter } from './pncounter';
export type { PNCounterJSON } from './pncounter';

// CRDT state manager
export { CRDTStateManager } from './state';

// Types
export type {
  CRDTExploreMapState,
  CRDTPanelData,
  CRDTExploreMapStateJSON,
  CRDTOperation,
  CRDTOperationType,
  AddPanelOperation,
  RemovePanelOperation,
  UpdatePanelPositionOperation,
  UpdatePanelSizeOperation,
  UpdatePanelZIndexOperation,
  UpdatePanelExploreStateOperation,
  UpdateTitleOperation,
  AddCommentOperation,
  RemoveCommentOperation,
  BatchOperation,
  OperationResult,
  CommentData,
} from './types';
