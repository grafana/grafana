import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { v4 as uuidv4 } from 'uuid';

import { generateExploreId } from 'app/core/utils/explore';

import { CanvasViewport, ExploreMapState, initialExploreMapState, PanelPosition, UserCursor } from './types';

const exploreMapSlice = createSlice({
  name: 'exploreMap',
  initialState: initialExploreMapState,
  reducers: {
    addPanel: (state, action: PayloadAction<{ position?: Partial<PanelPosition> }>) => {
      const panelId = uuidv4();
      const exploreId = generateExploreId();
      const defaultPosition: PanelPosition = {
        x: 100 + Object.keys(state.panels).length * 50,
        y: 100 + Object.keys(state.panels).length * 50,
        width: 600,
        height: 400,
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
        };
        state.nextZIndex++;
        state.selectedPanelId = newPanelId;
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
  loadCanvas,
  updateCursor,
  removeCursor,
} = exploreMapSlice.actions;

export const exploreMapReducer = exploreMapSlice.reducer;
