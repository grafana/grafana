import { reducerFactory } from '../../../../core/redux';
import { panelEditorCleanUp, panelEditorInitCompleted, panelEditorChangeTab } from './actions';

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

export const panelEditorReducer = reducerFactory<PanelEditorState>(initialState)
  .addMapper({
    filter: panelEditorInitCompleted,
    mapper: (state, action): PanelEditorState => {
      const { activeTab, tabs } = action.payload;
      return {
        ...state,
        activeTab,
        tabs,
      };
    },
  })
  .addMapper({
    filter: panelEditorCleanUp,
    mapper: (): PanelEditorState => initialState,
  })
  .addMapper({
    filter: panelEditorChangeTab,
    mapper: (state, action): PanelEditorState => {
      const activeTabId: PanelEditorTabIds = action.payload.activeTab.id as PanelEditorTabIds;
      const found = state.tabs.filter(tab => tab.id === activeTabId)[0];

      if (!found) {
        return state;
      }

      return {
        ...state,
        activeTab: action.payload.activeTab.id as PanelEditorTabIds,
      };
    },
  })
  .create();
