/**
 * CRDT-based Redux slice for Explore Map
 *
 * This slice wraps the CRDT state manager and provides Redux actions
 * for applying operations and managing local UI state.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

import { TimeRange } from '@grafana/data';
import { DataQuery } from '@grafana/schema';
import { generateExploreId } from 'app/core/utils/explore';

import { CRDTStateManager } from '../crdt/state';
import { CRDTOperation, CommentData, CRDTExploreMapStateJSON } from '../crdt/types';

import { CanvasViewport, SerializedExploreState, UserCursor } from './types';

/**
 * Combined state: CRDT state + local UI state
 */
export interface ExploreMapCRDTState {
  // Map metadata
  uid?: string;

  // CRDT state manager instance (serialized)
  crdtStateJSON?: string;

  // Node ID for this client
  nodeId: string;

  // Session ID for this browser tab (unique per tab)
  sessionId: string;

  // Operation queue (not serialized, reconstructed on load)
  pendingOperations: CRDTOperation[];

  // Local UI state (not replicated)
  local: {
    viewport: CanvasViewport;
    selectedPanelIds: string[];
    cursors: Record<string, UserCursor>;
    cursorMode: 'pointer' | 'hand';
    isOnline: boolean;
    isSyncing: boolean;
    activeDrag?: {
      draggedPanelId: string;
      deltaX: number;
      deltaY: number;
    };
    activeFrameDrag?: {
      draggedFrameId: string;
      deltaX: number;
      deltaY: number;
    };
    clipboard?: {
      panelData: {
        mode: 'explore' | 'traces-drilldown' | 'metrics-drilldown' | 'profiles-drilldown' | 'logs-drilldown';
        width: number;
        height: number;
        exploreState?: SerializedExploreState;
        iframeUrl?: string;
        createdBy?: string;
      };
    };
  };
}

const initialViewport: CanvasViewport = {
  zoom: 1,
  panX: -4040,
  panY: -4460,
};

/**
 * Create initial state with a new node ID and session ID
 */
export function createInitialCRDTState(mapUid?: string): ExploreMapCRDTState {
  const nodeId = uuidv4();
  const sessionId = uuidv4();
  const manager = new CRDTStateManager(mapUid || '', nodeId);

  return {
    uid: mapUid,
    crdtStateJSON: JSON.stringify(manager.toJSON()),
    nodeId,
    sessionId,
    pendingOperations: [],
    local: {
      viewport: initialViewport,
      selectedPanelIds: [],
      cursors: {},
      cursorMode: 'pointer',
      isOnline: false,
      isSyncing: false,
      activeDrag: undefined,
      activeFrameDrag: undefined,
      clipboard: undefined,
    },
  };
}

const initialState: ExploreMapCRDTState = createInitialCRDTState();

/**
 * Helper to get CRDT manager from state
 */
function getCRDTManager(state: ExploreMapCRDTState): CRDTStateManager {
  if (!state.crdtStateJSON) {
    return new CRDTStateManager(state.uid || '', state.nodeId);
  }

  const json = JSON.parse(state.crdtStateJSON);
  return CRDTStateManager.fromJSON(json, state.nodeId);
}

/**
 * Helper to save CRDT manager to state
 */
function saveCRDTManager(state: ExploreMapCRDTState, manager: CRDTStateManager): void {
  state.crdtStateJSON = JSON.stringify(manager.toJSON());
}

const crdtSlice = createSlice({
  name: 'exploreMapCRDT',
  initialState,
  reducers: {
    /**
     * Initialize with a new map UID
     */
    initializeMap: (state, action: PayloadAction<{ uid: string }>) => {
      state.uid = action.payload.uid;
      const manager = new CRDTStateManager(action.payload.uid, state.nodeId);
      saveCRDTManager(state, manager);
    },

    /**
     * Load CRDT state from server
     */
    loadState: (state, action: PayloadAction<{ crdtState: CRDTExploreMapStateJSON }>) => {
      const manager = CRDTStateManager.fromJSON(action.payload.crdtState, state.nodeId);
      saveCRDTManager(state, manager);
      // Restore uid from the loaded CRDT state
      const crdtState = manager.getState();
      state.uid = crdtState.uid;
    },

    /**
     * Initialize CRDT state from legacy ExploreMapState (for backward compatibility)
     */
    initializeFromLegacyState: (state, action: PayloadAction<{
      uid?: string;
      title?: string;
      panels: Record<string, {
        id: string;
        exploreId: string;
        position: { x: number; y: number; width: number; height: number; zIndex: number };
        exploreState?: SerializedExploreState;
      }>;
      viewport: CanvasViewport;
    }>) => {
      const { uid, title, panels, viewport } = action.payload;

      // Create a new manager
      const manager = new CRDTStateManager(uid || '', state.nodeId);

      // Set map title if provided
      if (title) {
        const titleOp = manager.createUpdateTitleOperation(title);
        manager.applyOperation(titleOp);
      }

      // Add all panels
      for (const panel of Object.values(panels)) {
        const addPanelOp = manager.createAddPanelOperation(
          panel.id,
          panel.exploreId,
          {
            x: panel.position.x,
            y: panel.position.y,
            width: panel.position.width,
            height: panel.position.height,
          }
        );
        manager.applyOperation(addPanelOp);

        // Set z-index
        const zIndexOp = manager.createUpdatePanelZIndexOperation(panel.id);
        if (zIndexOp) {
          manager.applyOperation(zIndexOp);
        }

        // Save explore state if present
        if (panel.exploreState) {
          const exploreStateOp = manager.createUpdatePanelExploreStateOperation(
            panel.id,
            panel.exploreState
          );
          if (exploreStateOp) {
            manager.applyOperation(exploreStateOp);
          }
        }
      }

      // Update state
      state.uid = uid;
      saveCRDTManager(state, manager);
      state.local.viewport = viewport;
    },

    /**
     * Apply a local or remote operation
     */
    applyOperation: (state, action: PayloadAction<{ operation: CRDTOperation }>) => {
      const manager = getCRDTManager(state);
      manager.applyOperation(action.payload.operation);
      saveCRDTManager(state, manager);
    },

    /**
     * Apply multiple operations in batch
     */
    applyOperations: (state, action: PayloadAction<{ operations: CRDTOperation[] }>) => {
      const manager = getCRDTManager(state);

      for (const operation of action.payload.operations) {
        manager.applyOperation(operation);
      }

      saveCRDTManager(state, manager);
    },

    /**
     * Add a panel (creates and applies operation)
     */
    addPanel: (state, action: PayloadAction<{
      viewportSize?: { width: number; height: number };
      position?: { x: number; y: number; width: number; height: number };
      kind?: 'explore' | 'traces-drilldown' | 'metrics-drilldown' | 'profiles-drilldown' | 'logs-drilldown';
      createdBy?: string;
      datasourceUid?: string;
      query?: string;
    }>) => {
      const manager = getCRDTManager(state);

      // Calculate position
      const viewportSize = action.payload.viewportSize || { width: 1920, height: 1080 };
      const canvasCenterX = (-state.local.viewport.panX + viewportSize.width / 2) / state.local.viewport.zoom;
      const canvasCenterY = (-state.local.viewport.panY + viewportSize.height / 2) / state.local.viewport.zoom;

      const mode = action.payload.kind || 'explore';

      // Set default panel size based on panel type
      // Drilldown panels are larger to accommodate the iframe content
      const isDrilldownPanel =
        mode === 'traces-drilldown' ||
        mode === 'metrics-drilldown' ||
        mode === 'profiles-drilldown' ||
        mode === 'logs-drilldown';
      const defaultWidth = isDrilldownPanel ? 1000 : 600;
      const defaultHeight = isDrilldownPanel ? 550 : 400;

      const panelWidth = action.payload.position?.width || defaultWidth;
      const panelHeight = action.payload.position?.height || defaultHeight;
      const panelCount = manager.getPanelIds().length;
      const offset = panelCount * 30;

      const position = action.payload.position || {
        x: canvasCenterX - panelWidth / 2 + offset,
        y: canvasCenterY - panelHeight / 2 + offset,
        width: panelWidth,
        height: panelHeight,
      };

      // Create operation
      const panelId = uuidv4();
      const exploreId = generateExploreId();

      // Build initial explore state with default time range
      // Always set a default time range (last 1 hour) to ensure panels work correctly
      // Note: We store strings instead of DateTime objects because they serialize properly through CRDT.
      // The receiver (useExploreStateReceiver) will extract the raw values and pass them to updateTime.

      // Type assertion needed because DataQuery doesn't include 'expr', but Prometheus queries use it
      const queries: DataQuery[] = action.payload.query
        ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
          ([
            {
              refId: 'A',
              datasource: { uid: action.payload.datasourceUid, type: 'prometheus' },
              expr: action.payload.query,
            },
          ] as unknown as DataQuery[])
        : [];

      // Create a time range that will serialize properly through CRDT.
      // We use strings for from/to instead of DateTime objects, which the receiver handles correctly.
      // Type assertion is necessary here because we're intentionally using strings for serialization.
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      const timeRange = {
        from: 'now-1h',
        to: 'now',
        raw: { from: 'now-1h', to: 'now' },
      } as unknown as TimeRange;

      const initialExploreState: SerializedExploreState = {
        queries,
        datasourceUid: action.payload.datasourceUid,
        range: timeRange,
      };

      const operation = manager.createAddPanelOperation(panelId, exploreId, position, mode, action.payload.createdBy, initialExploreState);

      // Apply locally
      manager.applyOperation(operation);
      saveCRDTManager(state, manager);

      // Add to pending operations for broadcast
      state.pendingOperations.push(operation);

      // Select the new panel
      state.local.selectedPanelIds = [panelId];
    },

    /**
     * Remove a panel
     */
    removePanel: (state, action: PayloadAction<{ panelId: string }>) => {
      const manager = getCRDTManager(state);

      const operation = manager.createRemovePanelOperation(action.payload.panelId);
      if (!operation) {
        return; // Panel doesn't exist
      }

      // Apply locally
      manager.applyOperation(operation);
      saveCRDTManager(state, manager);

      // Add to pending operations
      state.pendingOperations.push(operation);

      // Deselect the panel
      state.local.selectedPanelIds = state.local.selectedPanelIds.filter(
        (id) => id !== action.payload.panelId
      );
    },

    /**
     * Update panel position
     */
    updatePanelPosition: (
      state,
      action: PayloadAction<{ panelId: string; x: number; y: number }>
    ) => {
      const manager = getCRDTManager(state);

      const operation = manager.createUpdatePanelPositionOperation(
        action.payload.panelId,
        action.payload.x,
        action.payload.y
      );

      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);
      state.pendingOperations.push(operation);
    },

    /**
     * Update multiple panel positions (for moving selected panels together)
     */
    updateMultiplePanelPositions: (
      state,
      action: PayloadAction<{ panelId: string; deltaX: number; deltaY: number }>
    ) => {
      const manager = getCRDTManager(state);
      const { panelId, deltaX, deltaY } = action.payload;

      // Get all selected panels except the one being dragged
      const panelsToMove = state.local.selectedPanelIds.filter((id) => id !== panelId);

      // Update position for each panel
      for (const id of panelsToMove) {
        const panel = manager.getPanelForUI(id);
        if (panel) {
          const operation = manager.createUpdatePanelPositionOperation(
            id,
            panel.position.x + deltaX,
            panel.position.y + deltaY
          );

          if (operation) {
            manager.applyOperation(operation);
            state.pendingOperations.push(operation);
          }
        }
      }

      saveCRDTManager(state, manager);
    },

    /**
     * Update panel size
     */
    updatePanelSize: (
      state,
      action: PayloadAction<{ panelId: string; width: number; height: number }>
    ) => {
      const manager = getCRDTManager(state);

      const operation = manager.createUpdatePanelSizeOperation(
        action.payload.panelId,
        action.payload.width,
        action.payload.height
      );

      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);
      state.pendingOperations.push(operation);
    },

    /**
     * Bring panel to front
     */
    bringPanelToFront: (state, action: PayloadAction<{ panelId: string }>) => {
      const manager = getCRDTManager(state);

      // Check if panel is already at the front
      const currentPanel = manager.getPanelForUI(action.payload.panelId);
      if (!currentPanel) {
        return;
      }

      // Get all panels and find the max z-index
      const allPanels = manager.getAllPanelsForUI();
      const maxZIndex = Math.max(...Object.values(allPanels).map((p) => p.position.zIndex));

      // Only update if this panel isn't already at the front
      if (currentPanel.position.zIndex >= maxZIndex) {
        return;
      }

      const operation = manager.createUpdatePanelZIndexOperation(action.payload.panelId);
      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);
      state.pendingOperations.push(operation);
    },

    /**
     * Update panel explore state
     */
    savePanelExploreState: (
      state,
      action: PayloadAction<{ panelId: string; exploreState: SerializedExploreState }>
    ) => {
      const manager = getCRDTManager(state);

      const operation = manager.createUpdatePanelExploreStateOperation(
        action.payload.panelId,
        action.payload.exploreState
      );

      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);
      state.pendingOperations.push(operation);
    },

    /**
     * Update panel iframe URL
     */
    updatePanelIframeUrl: (
      state,
      action: PayloadAction<{ panelId: string; iframeUrl: string | undefined }>
    ) => {
      const manager = getCRDTManager(state);

      const operation = manager.createUpdatePanelIframeUrlOperation(
        action.payload.panelId,
        action.payload.iframeUrl
      );

      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);
      state.pendingOperations.push(operation);
    },

    /**
     * Update map title
     */
    updateMapTitle: (state, action: PayloadAction<{ title: string }>) => {
      const manager = getCRDTManager(state);

      const operation = manager.createUpdateTitleOperation(action.payload.title);

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);
      state.pendingOperations.push(operation);
    },

    /**
     * Add a comment
     */
    addComment: (state, action: PayloadAction<{ comment: CommentData }>) => {
      const manager = getCRDTManager(state);
      const commentId = uuidv4();

      const operation = manager.createAddCommentOperation(commentId, action.payload.comment);

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);
      state.pendingOperations.push(operation);
    },

    /**
     * Remove a comment
     */
    removeComment: (state, action: PayloadAction<{ commentId: string }>) => {
      const manager = getCRDTManager(state);

      const operation = manager.createRemoveCommentOperation(action.payload.commentId);

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);
      state.pendingOperations.push(operation);
    },

    /**
     * Add a sticky note
     */
    addPostItNote: (state, action: PayloadAction<{
      viewportSize?: { width: number; height: number };
      position?: { x: number; y: number; width: number; height: number };
      text?: string;
      color?: string;
      createdBy?: string;
    }>) => {
      const manager = getCRDTManager(state);

      // Calculate position
      const viewportSize = action.payload.viewportSize || { width: 1920, height: 1080 };
      const canvasCenterX = (-state.local.viewport.panX + viewportSize.width / 2) / state.local.viewport.zoom;
      const canvasCenterY = (-state.local.viewport.panY + viewportSize.height / 2) / state.local.viewport.zoom;

      const defaultWidth = 200;
      const defaultHeight = 200;
      const postItCount = manager.getPostItNoteIds().length;
      const offset = postItCount * 30;

      const position = action.payload.position || {
        x: canvasCenterX - defaultWidth / 2 + offset,
        y: canvasCenterY - defaultHeight / 2 + offset,
        width: defaultWidth,
        height: defaultHeight,
      };

      // Create operation
      const postItId = uuidv4();
      const operation = manager.createAddPostItOperation(
        postItId,
        position,
        action.payload.text,
        action.payload.color,
        action.payload.createdBy
      );

      // Apply locally
      manager.applyOperation(operation);
      saveCRDTManager(state, manager);

      // Add to pending operations for broadcast
      state.pendingOperations.push(operation);
    },

    /**
     * Remove a sticky note
     */
    removePostItNote: (state, action: PayloadAction<{ postItId: string }>) => {
      const manager = getCRDTManager(state);

      const operation = manager.createRemovePostItOperation(action.payload.postItId);
      if (!operation) {
        return; // Sticky note doesn't exist
      }

      // Apply locally
      manager.applyOperation(operation);
      saveCRDTManager(state, manager);

      // Add to pending operations
      state.pendingOperations.push(operation);
    },

    /**
     * Update sticky note position
     */
    updatePostItNotePosition: (
      state,
      action: PayloadAction<{ postItId: string; x: number; y: number }>
    ) => {
      const manager = getCRDTManager(state);

      const operation = manager.createUpdatePostItPositionOperation(
        action.payload.postItId,
        action.payload.x,
        action.payload.y
      );

      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);
      state.pendingOperations.push(operation);
    },

    /**
     * Update sticky note size
     */
    updatePostItNoteSize: (
      state,
      action: PayloadAction<{ postItId: string; width: number; height: number }>
    ) => {
      const manager = getCRDTManager(state);

      const operation = manager.createUpdatePostItSizeOperation(
        action.payload.postItId,
        action.payload.width,
        action.payload.height
      );

      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);
      state.pendingOperations.push(operation);
    },

    /**
     * Bring sticky note to front
     */
    bringPostItNoteToFront: (state, action: PayloadAction<{ postItId: string }>) => {
      const manager = getCRDTManager(state);

      const operation = manager.createUpdatePostItZIndexOperation(action.payload.postItId);
      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);
      state.pendingOperations.push(operation);
    },

    /**
     * Update sticky note text
     */
    updatePostItNoteText: (state, action: PayloadAction<{ postItId: string; text: string }>) => {
      const manager = getCRDTManager(state);

      const operation = manager.createUpdatePostItTextOperation(
        action.payload.postItId,
        action.payload.text
      );

      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);
      state.pendingOperations.push(operation);
    },

    /**
     * Update sticky note color
     */
    updatePostItNoteColor: (state, action: PayloadAction<{ postItId: string; color: string }>) => {
      const manager = getCRDTManager(state);

      const operation = manager.createUpdatePostItColorOperation(
        action.payload.postItId,
        action.payload.color
      );

      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);
      state.pendingOperations.push(operation);
    },

    /**
     * Associate post-it note with frame
     */
    associatePostItWithFrame: (state, action: PayloadAction<{
      postItId: string;
      frameId: string;
      offsetX: number;
      offsetY: number;
    }>) => {
      const manager = getCRDTManager(state);

      const operation = manager.createAssociatePostItWithFrameOperation(
        action.payload.postItId,
        action.payload.frameId,
        action.payload.offsetX,
        action.payload.offsetY
      );

      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);
      state.pendingOperations.push(operation);
    },

    /**
     * Disassociate post-it note from frame
     */
    disassociatePostItFromFrame: (state, action: PayloadAction<{
      postItId: string;
    }>) => {
      const manager = getCRDTManager(state);

      const operation = manager.createDisassociatePostItFromFrameOperation(
        action.payload.postItId
      );

      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);

      state.pendingOperations.push(operation);
    },

    /**
     * Duplicate a panel
     */
    duplicatePanel: (state, action: PayloadAction<{ panelId: string }>) => {
      const manager = getCRDTManager(state);
      const sourcePanel = manager.getPanelForUI(action.payload.panelId);

      if (!sourcePanel) {
        return;
      }

      // Create new panel with offset
      const newPanelId = uuidv4();
      const newExploreId = generateExploreId();
      const offset = 30;

      const addOperation = manager.createAddPanelOperation(
        newPanelId,
        newExploreId,
        {
          x: sourcePanel.position.x + offset,
          y: sourcePanel.position.y + offset,
          width: sourcePanel.position.width,
          height: sourcePanel.position.height,
        },
        sourcePanel.mode || 'explore',
        sourcePanel.createdBy
      );

      manager.applyOperation(addOperation);
      state.pendingOperations.push(addOperation);

      // Copy explore state if exists
      if (sourcePanel.exploreState) {
        const stateOperation = manager.createUpdatePanelExploreStateOperation(
          newPanelId,
          sourcePanel.exploreState
        );

        if (stateOperation) {
          manager.applyOperation(stateOperation);
          state.pendingOperations.push(stateOperation);
        }
      }

      saveCRDTManager(state, manager);
      state.local.selectedPanelIds = [newPanelId];
    },

    /**
     * Add a frame
     */
    addFrame: (state, action: PayloadAction<{
      position?: { x: number; y: number; width: number; height: number };
      title?: string;
      createdBy?: string;
      color?: string;
      emoji?: string;
    }>) => {
      const manager = getCRDTManager(state);

      const frameId = uuidv4();
      const title = action.payload.title || `Frame ${frameId.slice(0, 8)}`;
      const position = action.payload.position || {
        x: 200, y: 200, width: 800, height: 600
      };
      const color = action.payload.color || '#6e9fff'; // Default blue color
      const emoji = action.payload.emoji || '🔍'; // Default magnifying glass emoji

      const operation = manager.createAddFrameOperation(
        frameId,
        title,
        position,
        action.payload.createdBy,
        color,
        emoji
      );

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);

      state.pendingOperations.push(operation);
      state.local.selectedPanelIds = [];  // Clear panel selection
    },

    /**
     * Remove a frame
     */
    removeFrame: (state, action: PayloadAction<{ frameId: string; deletePanels?: boolean }>) => {
      const manager = getCRDTManager(state);

      // If deletePanels is true, first remove all panels in the frame
      if (action.payload.deletePanels) {
        const panelIds = manager.getPanelsInFrame(action.payload.frameId);
        for (const panelId of panelIds) {
          const panelOp = manager.createRemovePanelOperation(panelId);
          if (panelOp) {
            manager.applyOperation(panelOp);
            state.pendingOperations.push(panelOp);
          }
        }
      }

      const operation = manager.createRemoveFrameOperation(action.payload.frameId);
      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);

      state.pendingOperations.push(operation);
    },

    /**
     * Update frame position
     */
    updateFramePosition: (state, action: PayloadAction<{
      frameId: string;
      x: number;
      y: number;
    }>) => {
      const manager = getCRDTManager(state);

      // Calculate delta for batch-updating child panels
      const frame = manager.getFrameData(action.payload.frameId);
      if (!frame) {
        return;
      }

      const deltaX = action.payload.x - frame.positionX.get();
      const deltaY = action.payload.y - frame.positionY.get();

      // Create frame position operation
      const frameOp = manager.createUpdateFramePositionOperation(
        action.payload.frameId,
        action.payload.x,
        action.payload.y,
        deltaX,
        deltaY
      );

      if (!frameOp) {
        return;
      }

      // Create operations for all child panels
      const panelOps: CRDTOperation[] = [];
      const childPanelIds = manager.getPanelsInFrame(action.payload.frameId);

      for (const panelId of childPanelIds) {
        const panel = manager.getPanelData(panelId);
        if (panel) {
          const newX = panel.positionX.get() + deltaX;
          const newY = panel.positionY.get() + deltaY;

          const panelOp = manager.createUpdatePanelPositionOperation(panelId, newX, newY);
          if (panelOp) {
            panelOps.push(panelOp);
          }
        }
      }

      // Create operations for all child sticky notes
      const postItOps: CRDTOperation[] = [];
      const childPostItIds = manager.getPostItNotesInFrame(action.payload.frameId);

      for (const postItId of childPostItIds) {
        const postIt = manager.getPostItNoteData(postItId);
        if (postIt) {
          const newX = postIt.positionX.get() + deltaX;
          const newY = postIt.positionY.get() + deltaY;

          const postItOp = manager.createUpdatePostItPositionOperation(postItId, newX, newY);
          if (postItOp) {
            postItOps.push(postItOp);
          }
        }
      }

      // Apply all operations
      manager.applyOperation(frameOp);
      for (const op of panelOps) {
        manager.applyOperation(op);
      }
      for (const op of postItOps) {
        manager.applyOperation(op);
      }

      saveCRDTManager(state, manager);

      // Push all operations for broadcast
      state.pendingOperations.push(frameOp, ...panelOps, ...postItOps);
    },

    /**
     * Update frame size
     */
    updateFrameSize: (state, action: PayloadAction<{
      frameId: string;
      width: number;
      height: number;
    }>) => {
      const manager = getCRDTManager(state);

      const operation = manager.createUpdateFrameSizeOperation(
        action.payload.frameId,
        action.payload.width,
        action.payload.height
      );

      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);

      state.pendingOperations.push(operation);
    },

    /**
     * Update frame title
     */
    updateFrameTitle: (state, action: PayloadAction<{
      frameId: string;
      title: string;
    }>) => {
      const manager = getCRDTManager(state);

      const operation = manager.createUpdateFrameTitleOperation(
        action.payload.frameId,
        action.payload.title
      );

      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);

      state.pendingOperations.push(operation);
    },

    /**
     * Update frame color
     */
    updateFrameColor: (state, action: PayloadAction<{
      frameId: string;
      color: string | undefined;
    }>) => {
      const manager = getCRDTManager(state);

      const operation = manager.createUpdateFrameColorOperation(
        action.payload.frameId,
        action.payload.color
      );

      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);

      state.pendingOperations.push(operation);
    },

    /**
     * Update frame emoji
     */
    updateFrameEmoji: (state, action: PayloadAction<{
      frameId: string;
      emoji: string | undefined;
    }>) => {
      const manager = getCRDTManager(state);

      const operation = manager.createUpdateFrameEmojiOperation(
        action.payload.frameId,
        action.payload.emoji
      );

      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);

      state.pendingOperations.push(operation);
    },

    /**
     * Associate panel with frame
     */
    associatePanelWithFrame: (state, action: PayloadAction<{
      panelId: string;
      frameId: string;
      offsetX: number;
      offsetY: number;
    }>) => {
      const manager = getCRDTManager(state);

      const operation = manager.createAssociatePanelWithFrameOperation(
        action.payload.panelId,
        action.payload.frameId,
        action.payload.offsetX,
        action.payload.offsetY
      );

      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);

      state.pendingOperations.push(operation);
    },

    /**
     * Disassociate panel from frame
     */
    disassociatePanelFromFrame: (state, action: PayloadAction<{
      panelId: string;
    }>) => {
      const manager = getCRDTManager(state);

      const operation = manager.createDisassociatePanelFromFrameOperation(
        action.payload.panelId
      );

      if (!operation) {
        return;
      }

      manager.applyOperation(operation);
      saveCRDTManager(state, manager);

      state.pendingOperations.push(operation);
    },

    /**
     * Clear pending operations (after broadcast)
     */
    clearPendingOperations: (state) => {
      state.pendingOperations = [];
    },

    // Local UI state actions (not replicated)

    /**
     * Update viewport (pan/zoom)
     */
    updateViewport: (state, action: PayloadAction<Partial<CanvasViewport>>) => {
      state.local.viewport = { ...state.local.viewport, ...action.payload };
    },

    /**
     * Select panel(s)
     */
    selectPanel: (state, action: PayloadAction<{ panelId?: string; addToSelection?: boolean }>) => {
      const { panelId, addToSelection } = action.payload;

      if (!panelId) {
        state.local.selectedPanelIds = [];
        return;
      }

      if (addToSelection) {
        if (state.local.selectedPanelIds.includes(panelId)) {
          state.local.selectedPanelIds = state.local.selectedPanelIds.filter((id) => id !== panelId);
        } else {
          state.local.selectedPanelIds.push(panelId);
        }
      } else {
        state.local.selectedPanelIds = [panelId];
      }
    },

    /**
     * Select multiple panels
     */
    selectMultiplePanels: (state, action: PayloadAction<{ panelIds: string[]; addToSelection?: boolean }>) => {
      const { panelIds, addToSelection } = action.payload;

      if (addToSelection) {
        // Add to existing selection
        const newSelections = panelIds.filter((id) => !state.local.selectedPanelIds.includes(id));
        state.local.selectedPanelIds.push(...newSelections);
      } else {
        // Replace selection
        state.local.selectedPanelIds = panelIds;
      }
    },

    /**
     * Update cursor position (keyed by sessionId to support multiple sessions per user)
     */
    updateCursor: (state, action: PayloadAction<UserCursor>) => {
      state.local.cursors[action.payload.sessionId] = action.payload;
    },

    /**
     * Remove cursor (by sessionId)
     */
    removeCursor: (state, action: PayloadAction<{ sessionId: string }>) => {
      delete state.local.cursors[action.payload.sessionId];
    },

    /**
     * Set cursor mode (pointer or hand)
     */
    setCursorMode: (state, action: PayloadAction<{ mode: 'pointer' | 'hand' }>) => {
      state.local.cursorMode = action.payload.mode;
    },

    /**
     * Set online status
     */
    setOnlineStatus: (state, action: PayloadAction<{ isOnline: boolean }>) => {
      state.local.isOnline = action.payload.isOnline;
    },

    /**
     * Set syncing status
     */
    setSyncingStatus: (state, action: PayloadAction<{ isSyncing: boolean }>) => {
      state.local.isSyncing = action.payload.isSyncing;
    },

    /**
     * Set active drag info (for multi-panel drag visual feedback)
     */
    setActiveDrag: (state, action: PayloadAction<{ draggedPanelId: string; deltaX: number; deltaY: number }>) => {
      state.local.activeDrag = action.payload;
    },

    /**
     * Clear active drag info
     */
    clearActiveDrag: (state) => {
      state.local.activeDrag = undefined;
    },

    /**
     * Set active frame drag info (for frame drag visual feedback)
     */
    setActiveFrameDrag: (state, action: PayloadAction<{ draggedFrameId: string; deltaX: number; deltaY: number }>) => {
      state.local.activeFrameDrag = action.payload;
    },

    /**
     * Clear active frame drag info
     */
    clearActiveFrameDrag: (state) => {
      state.local.activeFrameDrag = undefined;
    },

    /**
     * Copy a panel to clipboard
     */
    copyPanel: (state, action: PayloadAction<{ panelId: string }>) => {
      const manager = getCRDTManager(state);
      const panel = manager.getPanelForUI(action.payload.panelId);

      if (!panel) {
        return;
      }

      // Store panel data in clipboard
      state.local.clipboard = {
        panelData: {
          mode: panel.mode || 'explore',
          width: panel.position.width,
          height: panel.position.height,
          exploreState: panel.exploreState,
          iframeUrl: panel.iframeUrl,
          createdBy: panel.createdBy,
        },
      };
    },

    /**
     * Paste a panel from clipboard
     * This action can be called with clipboardData for pasting from system clipboard
     */
    pastePanel: (state, action: PayloadAction<{
      viewportSize?: { width: number; height: number };
      createdBy?: string;
      clipboardData?: {
        mode: 'explore' | 'traces-drilldown' | 'metrics-drilldown' | 'profiles-drilldown' | 'logs-drilldown';
        width: number;
        height: number;
        exploreState?: SerializedExploreState;
        iframeUrl?: string;
        createdBy?: string;
      };
    }>) => {
      // Use provided clipboard data or fall back to local clipboard
      const clipboardData = action.payload.clipboardData || state.local.clipboard?.panelData;

      if (!clipboardData) {
        return;
      }

      const manager = getCRDTManager(state);

      // Calculate position at viewport center
      const viewportSize = action.payload.viewportSize || { width: 1920, height: 1080 };
      const canvasCenterX = (-state.local.viewport.panX + viewportSize.width / 2) / state.local.viewport.zoom;
      const canvasCenterY = (-state.local.viewport.panY + viewportSize.height / 2) / state.local.viewport.zoom;

      const position = {
        x: canvasCenterX - clipboardData.width / 2,
        y: canvasCenterY - clipboardData.height / 2,
        width: clipboardData.width,
        height: clipboardData.height,
      };

      // Create new panel
      const newPanelId = uuidv4();
      const newExploreId = generateExploreId();

      const addOperation = manager.createAddPanelOperation(
        newPanelId,
        newExploreId,
        position,
        clipboardData.mode || 'explore',
        action.payload.createdBy || clipboardData.createdBy
      );

      manager.applyOperation(addOperation);
      state.pendingOperations.push(addOperation);

      // Copy explore state if exists
      if (clipboardData.exploreState) {
        const stateOperation = manager.createUpdatePanelExploreStateOperation(
          newPanelId,
          clipboardData.exploreState
        );

        if (stateOperation) {
          manager.applyOperation(stateOperation);
          state.pendingOperations.push(stateOperation);
        }
      }

      // Copy iframe URL if exists
      if (clipboardData.iframeUrl) {
        const urlOperation = manager.createUpdatePanelIframeUrlOperation(
          newPanelId,
          clipboardData.iframeUrl
        );

        if (urlOperation) {
          manager.applyOperation(urlOperation);
          state.pendingOperations.push(urlOperation);
        }
      }

      saveCRDTManager(state, manager);
    },

    /**
     * Clear all state (reset)
     */
    clearMap: (state) => {
      const newState = createInitialCRDTState(state.uid);
      Object.assign(state, newState);
    },
  },
});

export const {
  initializeMap,
  loadState,
  initializeFromLegacyState,
  applyOperation,
  applyOperations,
  addPanel,
  removePanel,
  updatePanelPosition,
  updateMultiplePanelPositions,
  updatePanelSize,
  bringPanelToFront,
  savePanelExploreState,
  updatePanelIframeUrl,
  updateMapTitle,
  addComment,
  removeComment,
  addPostItNote,
  removePostItNote,
  updatePostItNotePosition,
  updatePostItNoteSize,
  bringPostItNoteToFront,
  updatePostItNoteText,
  updatePostItNoteColor,
  associatePostItWithFrame,
  disassociatePostItFromFrame,
  duplicatePanel,
  addFrame,
  removeFrame,
  updateFramePosition,
  updateFrameSize,
  updateFrameTitle,
  updateFrameColor,
  updateFrameEmoji,
  associatePanelWithFrame,
  disassociatePanelFromFrame,
  clearPendingOperations,
  updateViewport,
  selectPanel,
  selectMultiplePanels,
  updateCursor,
  removeCursor,
  setCursorMode,
  setOnlineStatus,
  setSyncingStatus,
  setActiveDrag,
  clearActiveDrag,
  setActiveFrameDrag,
  clearActiveFrameDrag,
  copyPanel,
  pastePanel,
  clearMap,
} = crdtSlice.actions;

export const crdtReducer = crdtSlice.reducer;
