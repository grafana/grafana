/**
 * CRDT-based Explore Map state types
 *
 * This file defines the CRDT-enhanced data structures for the Explore Map
 * feature, enabling conflict-free collaborative editing.
 */

import { SerializedExploreState } from '../state/types';

import { HLCTimestamp } from './hlc';
import { LWWRegister } from './lwwregister';
import { ORSet } from './orset';
import { PNCounter } from './pncounter';

/**
 * CRDT state for a single panel
 */
export interface CRDTPanelData {
  // Stable identifiers
  id: string;
  exploreId: string;

  // CRDT-replicated position properties
  positionX: LWWRegister<number>;
  positionY: LWWRegister<number>;
  width: LWWRegister<number>;
  height: LWWRegister<number>;
  zIndex: LWWRegister<number>;

  // CRDT-replicated explore state
  exploreState: LWWRegister<SerializedExploreState | undefined>;

  // Panel mode (explore, traces-drilldown, metrics-drilldown, profiles-drilldown, or logs-drilldown)
  mode: LWWRegister<'explore' | 'traces-drilldown' | 'metrics-drilldown' | 'profiles-drilldown' | 'logs-drilldown'>;

  // Iframe URL for traces-drilldown panels
  iframeUrl: LWWRegister<string | undefined>;

  // Creator metadata (username of who created the panel)
  createdBy: LWWRegister<string | undefined>;

  // Frame association properties
  frameId: LWWRegister<string | undefined>;      // Parent frame ID
  frameOffsetX: LWWRegister<number | undefined>; // Offset from frame origin
  frameOffsetY: LWWRegister<number | undefined>; // Offset from frame origin

  // Local counter incremented only for remote explore state updates
  remoteVersion: number;
}

/**
 * CRDT state for a single frame
 */
export interface CRDTFrameData {
  // Stable identifier
  id: string;

  // CRDT-replicated properties
  title: LWWRegister<string>;
  positionX: LWWRegister<number>;
  positionY: LWWRegister<number>;
  width: LWWRegister<number>;
  height: LWWRegister<number>;
  zIndex: LWWRegister<number>;
  color: LWWRegister<string | undefined>;
  emoji: LWWRegister<string | undefined>;

  // Creator metadata (username of who created the frame)
  createdBy: LWWRegister<string | undefined>;

  // Local counter incremented only for remote title updates
  remoteVersion: number;
}

/**
 * Complete CRDT-based Explore Map state
 */
export interface CommentData {
  text: string;
  username: string;
  timestamp: number; // Unix timestamp in milliseconds
}

/**
 * CRDT state for a single post-it note
 */
export interface CRDTPostItNoteData {
  // Stable identifier
  id: string;

  // CRDT-replicated position properties
  positionX: LWWRegister<number>;
  positionY: LWWRegister<number>;
  width: LWWRegister<number>;
  height: LWWRegister<number>;
  zIndex: LWWRegister<number>;

  // CRDT-replicated content
  text: LWWRegister<string>;
  color: LWWRegister<string>; // Color theme (e.g., 'yellow', 'pink', 'blue', 'green')

  // Creator metadata
  createdBy: LWWRegister<string | undefined>;
}

export interface CRDTExploreMapState {
  // Map metadata
  uid?: string;
  title: LWWRegister<string>;

  // Comment collection (OR-Set for add/remove operations)
  comments: ORSet<string>;  // Set of comment IDs

  // Comment data (text, username, timestamp)
  commentData: Map<string, CommentData>;

  // Post-it note collection (OR-Set for add/remove operations)
  postItNotes: ORSet<string>;  // Set of post-it note IDs

  // Post-it note data (position, size, content, color)
  postItNoteData: Map<string, CRDTPostItNoteData>;

  // Panel collection (OR-Set for add/remove operations)
  panels: ORSet<string>;  // Set of panel IDs

  // Panel data (position, size, content)
  panelData: Map<string, CRDTPanelData>;

  // Frame collection (OR-Set for add/remove operations)
  frames: ORSet<string>;  // Set of frame IDs

  // Frame data (position, size, title)
  frameData: Map<string, CRDTFrameData>;

  // Counter for allocating z-indices
  zIndexCounter: PNCounter;

  // Local-only state (not replicated via CRDT)
  local: {
    viewport: {
      zoom: number;
      panX: number;
      panY: number;
    };
    selectedPanelIds: string[];
    cursors: Record<string, {
      userId: string;
      userName: string;
      color: string;
      x: number;
      y: number;
      lastUpdated: number;
    }>;
  };
}

/**
 * JSON-serializable version of CRDT state
 */
export interface CRDTExploreMapStateJSON {
  uid?: string;
  title: {
    value: string;
    timestamp: HLCTimestamp;
  };
  comments?: {
    adds: Record<string, string[]>;
    removes: string[];
  };
  commentData?: Record<string, CommentData>;
  postItNotes?: {
    adds: Record<string, string[]>;
    removes: string[];
  };
  postItNoteData?: Record<string, {
    id: string;
    positionX: { value: number; timestamp: HLCTimestamp };
    positionY: { value: number; timestamp: HLCTimestamp };
    width: { value: number; timestamp: HLCTimestamp };
    height: { value: number; timestamp: HLCTimestamp };
    zIndex: { value: number; timestamp: HLCTimestamp };
    text: { value: string; timestamp: HLCTimestamp };
    color: { value: string; timestamp: HLCTimestamp };
    createdBy?: { value: string | undefined; timestamp: HLCTimestamp };
  }>;
  panels: {
    adds: Record<string, string[]>;
    removes: string[];
  };
  panelData: Record<string, {
    id: string;
    exploreId: string;
    positionX: { value: number; timestamp: HLCTimestamp };
    positionY: { value: number; timestamp: HLCTimestamp };
    width: { value: number; timestamp: HLCTimestamp };
    height: { value: number; timestamp: HLCTimestamp };
    zIndex: { value: number; timestamp: HLCTimestamp };
    exploreState: { value: SerializedExploreState | undefined; timestamp: HLCTimestamp };
    mode: { value: 'explore' | 'traces-drilldown' | 'metrics-drilldown' | 'profiles-drilldown' | 'logs-drilldown'; timestamp: HLCTimestamp };
    iframeUrl: { value: string | undefined; timestamp: HLCTimestamp };
    createdBy?: { value: string | undefined; timestamp: HLCTimestamp };
    frameId?: { value: string | undefined; timestamp: HLCTimestamp };
    frameOffsetX?: { value: number | undefined; timestamp: HLCTimestamp };
    frameOffsetY?: { value: number | undefined; timestamp: HLCTimestamp };
    remoteVersion?: number;
  }>;
  frames?: {
    adds: Record<string, string[]>;
    removes: string[];
  };
  frameData?: Record<string, {
    id: string;
    title: { value: string; timestamp: HLCTimestamp };
    positionX: { value: number; timestamp: HLCTimestamp };
    positionY: { value: number; timestamp: HLCTimestamp };
    width: { value: number; timestamp: HLCTimestamp };
    height: { value: number; timestamp: HLCTimestamp };
    zIndex: { value: number; timestamp: HLCTimestamp };
    color?: { value: string | undefined; timestamp: HLCTimestamp };
    emoji?: { value: string | undefined; timestamp: HLCTimestamp };
    createdBy?: { value: string | undefined; timestamp: HLCTimestamp };
    remoteVersion?: number;
  }>;
  zIndexCounter: {
    increments: Record<string, number>;
    decrements: Record<string, number>;
  };
}

/**
 * Operation types for CRDT updates
 */
export type CRDTOperationType =
  | 'add-panel'
  | 'remove-panel'
  | 'update-panel-position'
  | 'update-panel-size'
  | 'update-panel-zindex'
  | 'update-panel-explore-state'
  | 'update-panel-iframe-url'
  | 'update-title'
  | 'add-comment'
  | 'remove-comment'
  | 'add-frame'
  | 'remove-frame'
  | 'update-frame-position'
  | 'update-frame-size'
  | 'update-frame-title'
  | 'update-frame-color'
  | 'update-frame-emoji'
  | 'associate-panel-with-frame'
  | 'disassociate-panel-from-frame'
  | 'add-postit'
  | 'remove-postit'
  | 'update-postit-position'
  | 'update-postit-size'
  | 'update-postit-zindex'
  | 'update-postit-text'
  | 'update-postit-color'
  | 'batch';  // For batching multiple operations

/**
 * Base operation interface
 */
export interface CRDTOperationBase {
  type: CRDTOperationType;
  mapUid: string;
  operationId: string;      // Unique operation ID (UUID)
  timestamp: HLCTimestamp;
  nodeId: string;           // Client/user ID
}

/**
 * Add panel operation
 */
export interface AddPanelOperation extends CRDTOperationBase {
  type: 'add-panel';
  payload: {
    panelId: string;
    exploreId: string;
    position: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    mode?: 'explore' | 'traces-drilldown' | 'metrics-drilldown' | 'profiles-drilldown' | 'logs-drilldown';
    createdBy?: string;
    initialExploreState?: SerializedExploreState; // Optional initial datasource/query configuration
  };
}

/**
 * Remove panel operation
 */
export interface RemovePanelOperation extends CRDTOperationBase {
  type: 'remove-panel';
  payload: {
    panelId: string;
    observedTags: string[];  // Tags from OR-Set
  };
}

/**
 * Update panel position operation
 */
export interface UpdatePanelPositionOperation extends CRDTOperationBase {
  type: 'update-panel-position';
  payload: {
    panelId: string;
    x: number;
    y: number;
  };
}

/**
 * Update panel size operation
 */
export interface UpdatePanelSizeOperation extends CRDTOperationBase {
  type: 'update-panel-size';
  payload: {
    panelId: string;
    width: number;
    height: number;
  };
}

/**
 * Update panel z-index operation
 */
export interface UpdatePanelZIndexOperation extends CRDTOperationBase {
  type: 'update-panel-zindex';
  payload: {
    panelId: string;
    zIndex: number;
  };
}

/**
 * Update panel explore state operation
 */
export interface UpdatePanelExploreStateOperation extends CRDTOperationBase {
  type: 'update-panel-explore-state';
  payload: {
    panelId: string;
    exploreState: SerializedExploreState | undefined;
  };
}

/**
 * Update panel iframe URL operation
 */
export interface UpdatePanelIframeUrlOperation extends CRDTOperationBase {
  type: 'update-panel-iframe-url';
  payload: {
    panelId: string;
    iframeUrl: string | undefined;
  };
}

/**
 * Update map title operation
 */
export interface UpdateTitleOperation extends CRDTOperationBase {
  type: 'update-title';
  payload: {
    title: string;
  };
}

/**
 * Add comment operation
 */
export interface AddCommentOperation extends CRDTOperationBase {
  type: 'add-comment';
  payload: {
    commentId: string;
    comment: CommentData;
  };
}

/**
 * Remove comment operation
 */
export interface RemoveCommentOperation extends CRDTOperationBase {
  type: 'remove-comment';
  payload: {
    commentId: string;
    observedTags: string[];  // Tags from OR-Set
  };
}

/**
 * Add frame operation
 */
export interface AddFrameOperation extends CRDTOperationBase {
  type: 'add-frame';
  payload: {
    frameId: string;
    title: string;
    position: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    createdBy?: string;
    color?: string;
    emoji?: string;
  };
}

/**
 * Remove frame operation
 */
export interface RemoveFrameOperation extends CRDTOperationBase {
  type: 'remove-frame';
  payload: {
    frameId: string;
    observedTags: string[];  // Tags from OR-Set
  };
}

/**
 * Update frame position operation
 */
export interface UpdateFramePositionOperation extends CRDTOperationBase {
  type: 'update-frame-position';
  payload: {
    frameId: string;
    x: number;
    y: number;
    deltaX: number;  // For batch-updating child panels
    deltaY: number;
  };
}

/**
 * Update frame size operation
 */
export interface UpdateFrameSizeOperation extends CRDTOperationBase {
  type: 'update-frame-size';
  payload: {
    frameId: string;
    width: number;
    height: number;
  };
}

/**
 * Update frame title operation
 */
export interface UpdateFrameTitleOperation extends CRDTOperationBase {
  type: 'update-frame-title';
  payload: {
    frameId: string;
    title: string;
  };
}

/**
 * Update frame color operation
 */
export interface UpdateFrameColorOperation extends CRDTOperationBase {
  type: 'update-frame-color';
  payload: {
    frameId: string;
    color: string | undefined;
  };
}

/**
 * Update frame emoji operation
 */
export interface UpdateFrameEmojiOperation extends CRDTOperationBase {
  type: 'update-frame-emoji';
  payload: {
    frameId: string;
    emoji: string | undefined;
  };
}

/**
 * Associate panel with frame operation
 */
export interface AssociatePanelWithFrameOperation extends CRDTOperationBase {
  type: 'associate-panel-with-frame';
  payload: {
    panelId: string;
    frameId: string;
    offsetX: number;  // Relative to frame's top-left
    offsetY: number;
  };
}

/**
 * Disassociate panel from frame operation
 */
export interface DisassociatePanelFromFrameOperation extends CRDTOperationBase {
  type: 'disassociate-panel-from-frame';
  payload: {
    panelId: string;
  };
}



/**
 * Add post-it note operation
 */
export interface AddPostItOperation extends CRDTOperationBase {
  type: 'add-postit';
  payload: {
    postItId: string;
    position: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
    text?: string;
    color?: string;
    createdBy?: string;
  };
}

/**
 * Remove post-it note operation
 */
export interface RemovePostItOperation extends CRDTOperationBase {
  type: 'remove-postit';
  payload: {
    postItId: string;
    observedTags: string[];  // Tags from OR-Set
  };
}

/**
 * Update post-it note position operation
 */
export interface UpdatePostItPositionOperation extends CRDTOperationBase {
  type: 'update-postit-position';
  payload: {
    postItId: string;
    x: number;
    y: number;
  };
}

/**
 * Update post-it note size operation
 */
export interface UpdatePostItSizeOperation extends CRDTOperationBase {
  type: 'update-postit-size';
  payload: {
    postItId: string;
    width: number;
    height: number;
  };
}

/**
 * Update post-it note z-index operation
 */
export interface UpdatePostItZIndexOperation extends CRDTOperationBase {
  type: 'update-postit-zindex';
  payload: {
    postItId: string;
    zIndex: number;
  };
}

/**
 * Update post-it note text operation
 */
export interface UpdatePostItTextOperation extends CRDTOperationBase {
  type: 'update-postit-text';
  payload: {
    postItId: string;
    text: string;
  };
}

/**
 * Update post-it note color operation
 */
export interface UpdatePostItColorOperation extends CRDTOperationBase {
  type: 'update-postit-color';
  payload: {
    postItId: string;
    color: string;
  };
}


/**
 * Batch operation (multiple operations in one)
 */
export interface BatchOperation extends CRDTOperationBase {
  type: 'batch';
  payload: {
    operations: CRDTOperation[];
  };
}

/**
 * Union type of all operations
 */
export type CRDTOperation =
  | AddPanelOperation
  | RemovePanelOperation
  | UpdatePanelPositionOperation
  | UpdatePanelSizeOperation
  | UpdatePanelZIndexOperation
  | UpdatePanelExploreStateOperation
  | UpdatePanelIframeUrlOperation
  | UpdateTitleOperation
  | AddCommentOperation
  | RemoveCommentOperation
  | AddFrameOperation
  | RemoveFrameOperation
  | UpdateFramePositionOperation
  | UpdateFrameSizeOperation
  | UpdateFrameTitleOperation
  | UpdateFrameColorOperation
  | UpdateFrameEmojiOperation
  | AssociatePanelWithFrameOperation
  | DisassociatePanelFromFrameOperation
  | AddPostItOperation
  | RemovePostItOperation
  | UpdatePostItPositionOperation
  | UpdatePostItSizeOperation
  | UpdatePostItZIndexOperation
  | UpdatePostItTextOperation
  | UpdatePostItColorOperation
  | BatchOperation;

/**
 * Result of applying an operation
 */
export interface OperationResult {
  success: boolean;
  applied: boolean;     // Whether the operation made changes
  error?: string;
}
