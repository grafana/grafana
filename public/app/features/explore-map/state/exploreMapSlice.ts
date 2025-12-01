import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

import { generateExploreId } from 'app/core/utils/explore';

import {
  CanvasViewport,
  ExploreMapState,
  initialExploreMapState,
  PanelPosition,
  SerializedExploreState,
  UserCursor,
} from './types';

interface AddPanelPayload {
  position?: Partial<PanelPosition>;
  viewportSize?: { width: number; height: number };
}

const exploreMapSlice = createSlice({
  name: 'exploreMap',
  initialState: initialExploreMapState,
  reducers: {
    addPanel: (state, action: PayloadAction<AddPanelPayload>) => {
      const panelId = uuidv4();
      const exploreId = generateExploreId();

      // Calculate center of current viewport in canvas coordinates
      const viewportSize = action.payload.viewportSize || { width: 1920, height: 1080 };
      const canvasCenterX = (-state.viewport.panX + viewportSize.width / 2) / state.viewport.zoom;
      const canvasCenterY = (-state.viewport.panY + viewportSize.height / 2) / state.viewport.zoom;

      const panelWidth = 600;
      const panelHeight = 400;
      const offset = Object.keys(state.panels).length * 30;

      const defaultPosition: PanelPosition = {
        x: canvasCenterX - panelWidth / 2 + offset,
        y: canvasCenterY - panelHeight / 2 + offset,
        width: panelWidth,
        height: panelHeight,
        zIndex: state.nextZIndex,
      };

      state.panels[panelId] = {
        id: panelId,
        exploreId: exploreId,
        position: { ...defaultPosition, ...action.payload.position },
      };
      state.nextZIndex++;
      state.selectedPanelIds = [panelId];
    },

    removePanel: (state, action: PayloadAction<{ panelId: string }>) => {
      delete state.panels[action.payload.panelId];
      state.selectedPanelIds = state.selectedPanelIds.filter((id) => id !== action.payload.panelId);
    },

    updatePanelPosition: (
      state,
      action: PayloadAction<{ panelId: string; position: Partial<PanelPosition> }>
    ) => {
      const panel = state.panels[action.payload.panelId];
      if (panel) {
        panel.position = { ...panel.position, ...action.payload.position };
      }
    },

    updateMultiplePanelPositions: (
      state,
      action: PayloadAction<{ panelId: string; deltaX: number; deltaY: number }>
    ) => {
      const { panelId, deltaX, deltaY } = action.payload;

      // If the dragged panel is selected, move all selected panels EXCEPT the dragged one
      // (the dragged panel is controlled by react-rnd)
      if (state.selectedPanelIds.includes(panelId)) {
        state.selectedPanelIds.forEach((id) => {
          // Skip the panel being dragged - react-rnd controls it
          if (id === panelId) {
            return;
          }
          const panel = state.panels[id];
          if (panel) {
            panel.position.x += deltaX;
            panel.position.y += deltaY;
          }
        });
      } else {
        // If dragging a non-selected panel, just move that one
        const panel = state.panels[panelId];
        if (panel) {
          panel.position.x += deltaX;
          panel.position.y += deltaY;
        }
      }
    },

    bringPanelToFront: (state, action: PayloadAction<{ panelId: string }>) => {
      const panel = state.panels[action.payload.panelId];
      if (panel) {
        panel.position.zIndex = state.nextZIndex;
        state.nextZIndex++;
      }
    },

    selectPanel: (state, action: PayloadAction<{ panelId?: string; addToSelection?: boolean }>) => {
      const { panelId, addToSelection } = action.payload;

      if (!panelId) {
        // Clear selection
        state.selectedPanelIds = [];
        return;
      }

      if (addToSelection) {
        // Toggle panel in selection
        if (state.selectedPanelIds.includes(panelId)) {
          state.selectedPanelIds = state.selectedPanelIds.filter((id) => id !== panelId);
        } else {
          state.selectedPanelIds.push(panelId);
        }
      } else {
        // Single selection
        state.selectedPanelIds = [panelId];
      }

      // Bring all selected panels to front
      state.selectedPanelIds.forEach((id) => {
        const panel = state.panels[id];
        if (panel) {
          panel.position.zIndex = state.nextZIndex;
          state.nextZIndex++;
        }
      });
    },

    selectMultiplePanels: (state, action: PayloadAction<{ panelIds: string[]; addToSelection?: boolean }>) => {
      const { panelIds, addToSelection } = action.payload;

      if (addToSelection) {
        // Add to existing selection (dedupe)
        const newIds = panelIds.filter((id) => !state.selectedPanelIds.includes(id));
        state.selectedPanelIds = [...state.selectedPanelIds, ...newIds];
      } else {
        // Replace selection
        state.selectedPanelIds = panelIds;
      }

      // Bring all selected panels to front
      state.selectedPanelIds.forEach((id) => {
        const panel = state.panels[id];
        if (panel) {
          panel.position.zIndex = state.nextZIndex;
          state.nextZIndex++;
        }
      });
    },

    updateViewport: (state, action: PayloadAction<Partial<CanvasViewport>>) => {
      state.viewport = { ...state.viewport, ...action.payload };
    },

    resetCanvas: (state) => {
      state.panels = {};
      state.selectedPanelIds = [];
      state.nextZIndex = 1;
      state.viewport = initialExploreMapState.viewport;
    },

    duplicatePanel: (state, action: PayloadAction<{ panelId: string }>) => {
      const sourcePanel = state.panels[action.payload.panelId];
      if (sourcePanel) {
        const newPanelId = uuidv4();
        const newExploreId = generateExploreId();
        state.panels[newPanelId] = {
          id: newPanelId,
          exploreId: newExploreId,
          position: {
            ...sourcePanel.position,
            x: sourcePanel.position.x + 30,
            y: sourcePanel.position.y + 30,
            zIndex: state.nextZIndex,
          },
          exploreState: sourcePanel.exploreState,
        };
        state.nextZIndex++;
        state.selectedPanelIds = [newPanelId];
      }
    },

    savePanelExploreState: (
      state,
      action: PayloadAction<{ panelId: string; exploreState: SerializedExploreState }>
    ) => {
      const panel = state.panels[action.payload.panelId];
      if (panel) {
        panel.exploreState = action.payload.exploreState;
      }
    },

    loadCanvas: (state, action: PayloadAction<ExploreMapState>) => {
      const loadedState = action.payload;

      // Merge with initial state to ensure we always have required defaults
      // and to avoid persisting ephemeral state like selection and cursors.
      return {
        ...initialExploreMapState,
        ...loadedState,
        panels: loadedState.panels || {},
        selectedPanelIds: [],
        cursors: {},
      };
    },

    updateCursor: (state, action: PayloadAction<UserCursor>) => {
      state.cursors[action.payload.userId] = action.payload;
    },

    removeCursor: (state, action: PayloadAction<{ userId: string }>) => {
      delete state.cursors[action.payload.userId];
    },

    setMapMetadata: (state, action: PayloadAction<{ uid?: string; title?: string }>) => {
      state.uid = action.payload.uid;
      state.title = action.payload.title;
    },

    updateMapTitle: (state, action: PayloadAction<{ title: string }>) => {
      state.title = action.payload.title;
    },

    clearMap: () => {
      return initialExploreMapState;
    },
  },
});

export const {
  addPanel,
  removePanel,
  updatePanelPosition,
  updateMultiplePanelPositions,
  bringPanelToFront,
  selectPanel,
  selectMultiplePanels,
  updateViewport,
  resetCanvas,
  duplicatePanel,
  savePanelExploreState,
  loadCanvas,
  updateCursor,
  removeCursor,
  setMapMetadata,
  updateMapTitle,
  clearMap,
} = exploreMapSlice.actions;

export const exploreMapReducer = exploreMapSlice.reducer;
