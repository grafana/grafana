/**
 * Redux selectors for CRDT-based Explore Map state
 *
 * These selectors convert CRDT state into UI-friendly formats
 * for React components to consume.
 */

import { createSelector } from '@reduxjs/toolkit';

import { dateTime } from '@grafana/data';

import { CRDTStateManager } from '../crdt/state';

import { ExploreMapCRDTState } from './crdtSlice';
import { ExploreMapFrame, ExploreMapPanel } from './types';

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
 * Cache for individual panel objects
 * Key: panelId, Value: { panel object, serialized panel data for comparison }
 */
const panelCache = new Map<string, { panel: ExploreMapPanel; data: string }>();

/**
 * Cache for individual frame objects
 * Key: frameId, Value: { frame object, serialized frame data for comparison }
 */
const frameCache = new Map<string, { frame: ExploreMapFrame; data: string }>();

/**
 * Cache for individual post-it note objects
 * Key: postItId, Value: { postIt object, serialized postIt data for comparison }
 */
const postItCache = new Map<string, { postIt: any; data: string }>();

/**
 * Select all panels as a Record (for compatibility with existing UI)
 *
 * OPTIMIZATION: This selector caches individual panel objects and only creates
 * new panel objects when the underlying CRDT data for that specific panel changes.
 * This prevents unnecessary re-renders of unchanged panels when another panel is modified.
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
        cursorMode: 'pointer',
        isOnline: false,
        isSyncing: false,
        globalTimeRange: { from: dateTime().subtract(1, 'hour'), to: dateTime(), raw: { from: 'now-1h', to: 'now' } },
      },
    };
    const manager = getCRDTManager(state);
    const panels: Record<string, ExploreMapPanel> = {};
    const currentPanelIds = new Set(manager.getPanelIds());

    // Clean up cache for removed panels
    for (const cachedPanelId of panelCache.keys()) {
      if (!currentPanelIds.has(cachedPanelId)) {
        panelCache.delete(cachedPanelId);
      }
    }

    // Build panels object, reusing cached objects when data hasn't changed
    for (const panelId of currentPanelIds) {
      const panelData = manager.getPanelForUI(panelId);
      if (!panelData) {
        continue;
      }

      // Serialize the panel data to detect changes
      const serializedData = JSON.stringify(panelData);
      const cached = panelCache.get(panelId);

      // Reuse cached panel if data hasn't changed
      if (cached && cached.data === serializedData) {
        panels[panelId] = cached.panel;
      } else {
        // Panel is new or changed, create new object and cache it
        const panel = panelData as ExploreMapPanel;
        panels[panelId] = panel;
        panelCache.set(panelId, { panel, data: serializedData });
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
 * Select all frames as a Record (for compatibility with existing UI)
 *
 * OPTIMIZATION: This selector caches individual frame objects and only creates
 * new frame objects when the underlying CRDT data for that specific frame changes.
 * This prevents unnecessary re-renders of unchanged frames when another frame is modified.
 */
export const selectFrames = createSelector(
  [
    (state: ExploreMapCRDTState) => state.crdtStateJSON,
    (state: ExploreMapCRDTState) => state.nodeId,
    (state: ExploreMapCRDTState) => state.uid,
  ],
  (crdtStateJSON, nodeId, uid): Record<string, ExploreMapFrame> => {
    const state: ExploreMapCRDTState = {
      uid,
      crdtStateJSON,
      nodeId,
      sessionId: '', // Not needed for frame selection
      pendingOperations: [],
      local: {
        viewport: { zoom: 1, panX: 0, panY: 0 },
        selectedPanelIds: [],
        cursors: {},
        cursorMode: 'pointer',
        isOnline: false,
        isSyncing: false,
        globalTimeRange: { from: dateTime().subtract(1, 'hour'), to: dateTime(), raw: { from: 'now-1h', to: 'now' } },
      },
    };
    const manager = getCRDTManager(state);
    const frames: Record<string, ExploreMapFrame> = {};
    const currentFrameIds = new Set(manager.getFrameIds());

    // Clean up cache for removed frames
    for (const cachedFrameId of frameCache.keys()) {
      if (!currentFrameIds.has(cachedFrameId)) {
        frameCache.delete(cachedFrameId);
      }
    }

    // Build frames object, reusing cached objects when data hasn't changed
    for (const frameId of currentFrameIds) {
      const frameData = manager.getFrameForUI(frameId);
      if (!frameData) {
        continue;
      }

      // Serialize the frame data to detect changes
      const serializedData = JSON.stringify(frameData);
      const cached = frameCache.get(frameId);

      // Reuse cached frame if data hasn't changed
      if (cached && cached.data === serializedData) {
        frames[frameId] = cached.frame;
      } else {
        // Frame is new or changed, create new object and cache it
        const frame = frameData as ExploreMapFrame;
        frames[frameId] = frame;
        frameCache.set(frameId, { frame, data: serializedData });
      }
    }

    return frames;
  }
);

/**
 * Select a single frame by ID
 */
export const selectFrame = createSelector(
  [
    (state: ExploreMapCRDTState) => state,
    (_state: ExploreMapCRDTState, frameId: string) => frameId,
  ],
  (state, frameId): ExploreMapFrame | undefined => {
    const manager = getCRDTManager(state);
    const frameData = manager.getFrameForUI(frameId);
    return frameData ? (frameData as ExploreMapFrame) : undefined;
  }
);

/**
 * Select frame IDs
 */
export const selectFrameIds = createSelector(
  [(state: ExploreMapCRDTState) => state],
  (state): string[] => {
    const manager = getCRDTManager(state);
    return manager.getFrameIds();
  }
);

/**
 * Select all panels in a specific frame
 */
export const selectPanelsInFrame = createSelector(
  [
    (state: ExploreMapCRDTState) => state,
    (_state: ExploreMapCRDTState, frameId: string) => frameId,
  ],
  (state, frameId): string[] => {
    const manager = getCRDTManager(state);
    return manager.getPanelsInFrame(frameId);
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
 * Select all post-it notes as a Record
 *
 * OPTIMIZATION: This selector caches individual post-it note objects and only creates
 * new post-it note objects when the underlying CRDT data for that specific post-it note changes.
 * This prevents unnecessary re-renders of unchanged post-it notes when another post-it note is modified.
 */
export const selectPostItNotes = createSelector(
  [
    (state: ExploreMapCRDTState) => state.crdtStateJSON,
    (state: ExploreMapCRDTState) => state.nodeId,
    (state: ExploreMapCRDTState) => state.uid,
  ],
  (crdtStateJSON, nodeId, uid): Record<string, any> => {
    const state: ExploreMapCRDTState = {
      uid,
      crdtStateJSON,
      nodeId,
      sessionId: '', // Not needed for post-it note selection
      pendingOperations: [],
      local: {
        viewport: { zoom: 1, panX: 0, panY: 0 },
        selectedPanelIds: [],
        cursors: {},
        cursorMode: 'pointer',
        isOnline: false,
        isSyncing: false,
        globalTimeRange: { from: dateTime().subtract(1, 'hour'), to: dateTime(), raw: { from: 'now-1h', to: 'now' } },
      },
    };
    const manager = getCRDTManager(state);
    const postItNotes: Record<string, any> = {};
    const currentPostItIds = new Set(manager.getPostItNoteIds());

    // Clean up cache for removed post-it notes
    for (const cachedPostItId of postItCache.keys()) {
      if (!currentPostItIds.has(cachedPostItId)) {
        postItCache.delete(cachedPostItId);
      }
    }

    // Build post-it notes object, reusing cached objects when data hasn't changed
    for (const postItId of currentPostItIds) {
      const postItData = manager.getPostItNoteForUI(postItId);
      if (!postItData) {
        continue;
      }

      // Serialize the post-it note data to detect changes
      const serializedData = JSON.stringify(postItData);
      const cached = postItCache.get(postItId);

      // Reuse cached post-it note if data hasn't changed
      if (cached && cached.data === serializedData) {
        postItNotes[postItId] = cached.postIt;
      } else {
        // Post-it note is new or changed, create new object and cache it
        postItNotes[postItId] = postItData;
        postItCache.set(postItId, { postIt: postItData, data: serializedData });
      }
    }

    return postItNotes;
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
 * Select cursor mode
 */
export const selectCursorMode = (state: ExploreMapCRDTState) => {
  return state.local.cursorMode;
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
 * Select clipboard state
 */
export const selectClipboard = (state: ExploreMapCRDTState) => {
  return state.local.clipboard;
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
 * Select active users from cursors
 * Groups by userId and filters out stale cursors (not updated in last 15 minutes)
 */
export const selectActiveUsers = createSelector(
  [selectCursors],
  (cursors) => {
    const now = Date.now();
    const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

    // Group cursors by userId and keep the most recent one for each user
    const userMap = new Map<string, { userId: string; userName: string; lastUpdated: number }>();

    for (const cursor of Object.values(cursors)) {
      // Filter out stale cursors
      if (now - cursor.lastUpdated > STALE_THRESHOLD_MS) {
        continue;
      }

      // Keep the most recent cursor for each user
      const existing = userMap.get(cursor.userId);
      if (!existing || cursor.lastUpdated > existing.lastUpdated) {
        userMap.set(cursor.userId, {
          userId: cursor.userId,
          userName: cursor.userName,
          lastUpdated: cursor.lastUpdated,
        });
      }
    }

    // Convert to UserView format for UsersIndicator component
    return Array.from(userMap.values())
      .map((user) => ({
        user: {
          name: user.userName,
        },
        lastActiveAt: new Date(user.lastUpdated).toISOString(),
      }))
      .sort((a, b) => new Date(b.lastActiveAt).getTime() - new Date(a.lastActiveAt).getTime());
  }
);

/**
 * Select the entire legacy-compatible state
 * Useful for gradual migration
 */
export const selectLegacyState = createSelector(
  [
    selectPanels,
    selectFrames,
    selectMapTitle,
    selectViewport,
    selectSelectedPanelIds,
    selectCursors,
    selectMapUid,
    (state: ExploreMapCRDTState) => state,
  ],
  (panels, frames, title, viewport, selectedPanelIds, cursors, uid, state) => {
    const manager = getCRDTManager(state);
    const crdtState = manager.getState();

    return {
      uid,
      title,
      viewport,
      panels,
      frames,
      selectedPanelIds,
      nextZIndex: crdtState.zIndexCounter.value() + 1,
      cursors,
    };
  }
);
