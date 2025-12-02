/**
 * CRDT-based Redux slice for Explore Map
 *
 * This slice wraps the CRDT state manager and provides Redux actions
 * for applying operations and managing local UI state.
 */

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

import { generateExploreId } from 'app/core/utils/explore';

import { CRDTStateManager } from '../crdt/state';
import { CRDTOperation } from '../crdt/types';

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

  // Operation queue (not serialized, reconstructed on load)
  pendingOperations: CRDTOperation[];

  // Local UI state (not replicated)
  local: {
    viewport: CanvasViewport;
    selectedPanelIds: string[];
    cursors: Record<string, UserCursor>;
    isOnline: boolean;
    isSyncing: boolean;
  };
}

const initialViewport: CanvasViewport = {
  zoom: 1,
  panX: -4040,
  panY: -4460,
};

/**
 * Create initial state with a new node ID
 */
export function createInitialCRDTState(mapUid?: string): ExploreMapCRDTState {
  const nodeId = uuidv4();
  const manager = new CRDTStateManager(mapUid || '', nodeId);

  return {
    uid: mapUid,
    crdtStateJSON: JSON.stringify(manager.toJSON()),
    nodeId,
    pendingOperations: [],
    local: {
      viewport: initialViewport,
      selectedPanelIds: [],
      cursors: {},
      isOnline: false,
      isSyncing: false,
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
    loadState: (state, action: PayloadAction<{ crdtState: any }>) => {
      const manager = CRDTStateManager.fromJSON(action.payload.crdtState, state.nodeId);
      saveCRDTManager(state, manager);
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
      kind?: 'explore' | 'traces-drilldown';
    }>) => {
      const manager = getCRDTManager(state);

      // Calculate position
      const viewportSize = action.payload.viewportSize || { width: 1920, height: 1080 };
      const canvasCenterX = (-state.local.viewport.panX + viewportSize.width / 2) / state.local.viewport.zoom;
      const canvasCenterY = (-state.local.viewport.panY + viewportSize.height / 2) / state.local.viewport.zoom;

      const panelWidth = action.payload.position?.width || 600;
      const panelHeight = action.payload.position?.height || 400;
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
      const mode = action.payload.kind || 'explore';

      const operation = manager.createAddPanelOperation(panelId, exploreId, position, mode);

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
        sourcePanel.mode || 'explore'
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
     * Update cursor position
     */
    updateCursor: (state, action: PayloadAction<UserCursor>) => {
      state.local.cursors[action.payload.userId] = action.payload;
    },

    /**
     * Remove cursor
     */
    removeCursor: (state, action: PayloadAction<{ userId: string }>) => {
      delete state.local.cursors[action.payload.userId];
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
  duplicatePanel,
  clearPendingOperations,
  updateViewport,
  selectPanel,
  selectMultiplePanels,
  updateCursor,
  removeCursor,
  setOnlineStatus,
  setSyncingStatus,
  clearMap,
} = crdtSlice.actions;

export const crdtReducer = crdtSlice.reducer;
