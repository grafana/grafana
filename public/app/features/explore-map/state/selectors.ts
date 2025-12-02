/**
 * Redux selectors for CRDT-based Explore Map state
 *
 * These selectors convert CRDT state into UI-friendly formats
 * for React components to consume.
 */

import { createSelector } from '@reduxjs/toolkit';

import { CRDTStateManager } from '../crdt/state';

import { ExploreMapCRDTState } from './crdtSlice';
import { ExploreMapPanel } from './types';

/**
 * Get CRDT manager from state
 */
function getCRDTManager(state: ExploreMapCRDTState): CRDTStateManager {
  if (!state.crdtStateJSON) {
    return new CRDTStateManager(state.uid || '', state.nodeId);
  }

  const json = JSON.parse(state.crdtStateJSON);
  return CRDTStateManager.fromJSON(json, state.nodeId);
}

/**
 * Select all panels as a Record (for compatibility with existing UI)
 */
export const selectPanels = createSelector(
  [
    (state: ExploreMapCRDTState) => state.crdtStateJSON,
    (state: ExploreMapCRDTState) => state.nodeId,
    (state: ExploreMapCRDTState) => state.uid,
  ],
  (crdtStateJSON, nodeId, uid): Record<string, ExploreMapPanel> => {
    const state: ExploreMapCRDTState = {
      uid,
      crdtStateJSON,
      nodeId,
      sessionId: '', // Not needed for panel selection
      pendingOperations: [],
      local: {
        viewport: { zoom: 1, panX: 0, panY: 0 },
        selectedPanelIds: [],
        cursors: {},
        isOnline: false,
        isSyncing: false,
      },
    };
    const manager = getCRDTManager(state);
    const panels: Record<string, ExploreMapPanel> = {};

    for (const panelId of manager.getPanelIds()) {
      const panelData = manager.getPanelForUI(panelId);
      if (panelData) {
        panels[panelId] = panelData as ExploreMapPanel;
      }
    }

    return panels;
  }
);

/**
 * Select a single panel by ID
 */
export const selectPanel = createSelector(
  [
    (state: ExploreMapCRDTState) => state,
    (_state: ExploreMapCRDTState, panelId: string) => panelId,
  ],
  (state, panelId): ExploreMapPanel | undefined => {
    const manager = getCRDTManager(state);
    const panelData = manager.getPanelForUI(panelId);
    return panelData ? (panelData as ExploreMapPanel) : undefined;
  }
);

/**
 * Select panel IDs
 */
export const selectPanelIds = createSelector(
  [(state: ExploreMapCRDTState) => state],
  (state): string[] => {
    const manager = getCRDTManager(state);
    return manager.getPanelIds();
  }
);

/**
 * Select map title
 */
export const selectMapTitle = createSelector(
  [(state: ExploreMapCRDTState) => state],
  (state): string => {
    const manager = getCRDTManager(state);
    const crdtState = manager.getState();
    return crdtState.title.get();
  }
);

/**
 * Select all comments as an array, sorted by timestamp (newest first)
 */
export const selectComments = createSelector(
  [(state: ExploreMapCRDTState) => state],
  (state) => {
    const manager = getCRDTManager(state);
    return manager.getCommentsForUI();
  }
);

/**
 * Select map UID
 */
export const selectMapUid = (state: ExploreMapCRDTState): string | undefined => {
  return state.uid;
};

/**
 * Select viewport
 */
export const selectViewport = (state: ExploreMapCRDTState) => {
  return state.local.viewport;
};

/**
 * Select selected panel IDs
 */
export const selectSelectedPanelIds = (state: ExploreMapCRDTState): string[] => {
  return state.local.selectedPanelIds;
};

/**
 * Select cursors
 */
export const selectCursors = (state: ExploreMapCRDTState) => {
  return state.local.cursors;
};

/**
 * Select online status
 */
export const selectIsOnline = (state: ExploreMapCRDTState): boolean => {
  return state.local.isOnline;
};

/**
 * Select syncing status
 */
export const selectIsSyncing = (state: ExploreMapCRDTState): boolean => {
  return state.local.isSyncing;
};

/**
 * Select pending operations
 */
export const selectPendingOperations = (state: ExploreMapCRDTState) => {
  return state.pendingOperations;
};

/**
 * Select whether there are pending operations to broadcast
 */
export const selectHasPendingOperations = (state: ExploreMapCRDTState): boolean => {
  return state.pendingOperations.length > 0;
};

/**
 * Select node ID
 */
export const selectNodeId = (state: ExploreMapCRDTState): string => {
  return state.nodeId;
};

/**
 * Select session ID
 */
export const selectSessionId = (state: ExploreMapCRDTState): string => {
  return state.sessionId;
};

/**
 * Select panel count
 */
export const selectPanelCount = createSelector(
  [(state: ExploreMapCRDTState) => state],
  (state): number => {
    const manager = getCRDTManager(state);
    return manager.getPanelIds().length;
  }
);

/**
 * Select selected panels
 */
export const selectSelectedPanels = createSelector(
  [selectPanels, selectSelectedPanelIds],
  (panels, selectedIds): ExploreMapPanel[] => {
    return selectedIds.map((id) => panels[id]).filter(Boolean);
  }
);

/**
 * Check if a panel is selected
 */
export const selectIsPanelSelected = createSelector(
  [
    selectSelectedPanelIds,
    (_state: ExploreMapCRDTState, panelId: string) => panelId,
  ],
  (selectedIds, panelId): boolean => {
    return selectedIds.includes(panelId);
  }
);

/**
 * Get the highest z-index (for bringing panels to front)
 */
export const selectMaxZIndex = createSelector(
  [selectPanels],
  (panels): number => {
    let max = 0;
    for (const panel of Object.values(panels)) {
      if (panel.position.zIndex > max) {
        max = panel.position.zIndex;
      }
    }
    return max;
  }
);

/**
 * Get bounding box of all selected panels
 */
export const selectSelectedPanelsBounds = createSelector(
  [selectSelectedPanels],
  (panels): { minX: number; minY: number; maxX: number; maxY: number } | null => {
    if (panels.length === 0) {
      return null;
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const panel of panels) {
      const { x, y, width, height } = panel.position;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    }

    return { minX, minY, maxX, maxY };
  }
);

/**
 * Select entire CRDT state as JSON (for persistence)
 */
export const selectCRDTStateJSON = (state: ExploreMapCRDTState): string | undefined => {
  return state.crdtStateJSON;
};

/**
 * Select the entire legacy-compatible state
 * Useful for gradual migration
 */
export const selectLegacyState = createSelector(
  [
    selectPanels,
    selectMapTitle,
    selectViewport,
    selectSelectedPanelIds,
    selectCursors,
    selectMapUid,
    (state: ExploreMapCRDTState) => state,
  ],
  (panels, title, viewport, selectedPanelIds, cursors, uid, state) => {
    const manager = getCRDTManager(state);
    const crdtState = manager.getState();

    return {
      uid,
      title,
      viewport,
      panels,
      selectedPanelIds,
      nextZIndex: crdtState.zIndexCounter.value() + 1,
      cursors,
    };
  }
);
