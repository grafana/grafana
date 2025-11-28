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
      state.selectedPanelId = panelId;
    },

    removePanel: (state, action: PayloadAction<{ panelId: string }>) => {
      delete state.panels[action.payload.panelId];
      if (state.selectedPanelId === action.payload.panelId) {
        state.selectedPanelId = undefined;
      }
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

    bringPanelToFront: (state, action: PayloadAction<{ panelId: string }>) => {
      const panel = state.panels[action.payload.panelId];
      if (panel) {
        panel.position.zIndex = state.nextZIndex;
        state.nextZIndex++;
      }
    },

    selectPanel: (state, action: PayloadAction<{ panelId?: string }>) => {
      state.selectedPanelId = action.payload.panelId;
      if (action.payload.panelId) {
        const panel = state.panels[action.payload.panelId];
        if (panel) {
          panel.position.zIndex = state.nextZIndex;
          state.nextZIndex++;
        }
      }
    },

    updateViewport: (state, action: PayloadAction<Partial<CanvasViewport>>) => {
      state.viewport = { ...state.viewport, ...action.payload };
    },

    resetCanvas: (state) => {
      state.panels = {};
      state.selectedPanelId = undefined;
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
        state.selectedPanelId = newPanelId;
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
      return action.payload;
    },

    updateCursor: (state, action: PayloadAction<UserCursor>) => {
      state.cursors[action.payload.userId] = action.payload;
    },

    removeCursor: (state, action: PayloadAction<{ userId: string }>) => {
      delete state.cursors[action.payload.userId];
    },
  },
});

export const {
  addPanel,
  removePanel,
  updatePanelPosition,
  bringPanelToFront,
  selectPanel,
  updateViewport,
  resetCanvas,
  duplicatePanel,
  savePanelExploreState,
  loadCanvas,
  updateCursor,
  removeCursor,
} = exploreMapSlice.actions;

export const exploreMapReducer = exploreMapSlice.reducer;
