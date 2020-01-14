import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface PanelEditorInitCompleted {
  activeTab: PanelEditorTabIds;
  tabs: PanelEditorTab[];
}

export interface PanelEditorTab {
  id: string;
  text: string;
}

export enum PanelEditorTabIds {
  Queries = 'queries',
  Visualization = 'visualization',
  Advanced = 'advanced',
  Alert = 'alert',
}

export const panelEditorTabTexts = {
  [PanelEditorTabIds.Queries]: 'Queries',
  [PanelEditorTabIds.Visualization]: 'Visualization',
  [PanelEditorTabIds.Advanced]: 'General',
  [PanelEditorTabIds.Alert]: 'Alert',
};

export const getPanelEditorTab = (tabId: PanelEditorTabIds): PanelEditorTab => {
  return {
    id: tabId,
    text: panelEditorTabTexts[tabId],
  };
};

export interface PanelEditorState {
  activeTab: PanelEditorTabIds;
  tabs: PanelEditorTab[];
}

export const initialState: PanelEditorState = {
  activeTab: null,
  tabs: [],
};

const panelEditorSlice = createSlice({
  name: 'panelEditor',
  initialState,
  reducers: {
    panelEditorInitCompleted: (state, action: PayloadAction<PanelEditorInitCompleted>): PanelEditorState => {
      const { activeTab, tabs } = action.payload;
      return {
        ...state,
        activeTab,
        tabs,
      };
    },
    panelEditorCleanUp: (state, action: PayloadAction<undefined>): PanelEditorState => initialState,
  },
});

export const { panelEditorCleanUp, panelEditorInitCompleted } = panelEditorSlice.actions;

export const panelEditorReducer = panelEditorSlice.reducer;
