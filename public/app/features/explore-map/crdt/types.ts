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

  // Panel mode (explore, traces-drilldown, or metrics-drilldown)
  mode: LWWRegister<'explore' | 'traces-drilldown' | 'metrics-drilldown'>;

  // Iframe URL for traces-drilldown panels
  iframeUrl: LWWRegister<string | undefined>;

  // Local counter incremented only for remote explore state updates
  remoteVersion: number;
}

/**
 * Complete CRDT-based Explore Map state
 */
export interface CRDTExploreMapState {
  // Map metadata
  uid?: string;
  title: LWWRegister<string>;

  // Panel collection (OR-Set for add/remove operations)
  panels: ORSet<string>;  // Set of panel IDs

  // Panel data (position, size, content)
  panelData: Map<string, CRDTPanelData>;

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
    mode: { value: 'explore' | 'traces-drilldown' | 'metrics-drilldown'; timestamp: HLCTimestamp };
    iframeUrl: { value: string | undefined; timestamp: HLCTimestamp };
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
    mode?: 'explore' | 'traces-drilldown' | 'metrics-drilldown';
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
  | BatchOperation;

/**
 * Result of applying an operation
 */
export interface OperationResult {
  success: boolean;
  applied: boolean;     // Whether the operation made changes
  error?: string;
}
