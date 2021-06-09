import { AnyAction } from 'redux';
import { createAction } from '@reduxjs/toolkit';
import { PanelPluginMeta, SelectableValue } from '@grafana/data';

import { FolderInfo } from '../../../../types';

export interface LibraryPanelsSearchState {
  searchQuery: string;
  sortDirection?: string;
  panelFilter: string[];
  folderFilter: string[];
}

export const initialLibraryPanelsSearchState: LibraryPanelsSearchState = {
  searchQuery: '',
  panelFilter: [],
  folderFilter: [],
  sortDirection: undefined,
};

export const searchChanged = createAction<string>('libraryPanels/search/searchChanged');
export const sortChanged = createAction<SelectableValue<string>>('libraryPanels/search/sortChanged');
export const panelFilterChanged = createAction<PanelPluginMeta[]>('libraryPanels/search/panelFilterChanged');
export const folderFilterChanged = createAction<FolderInfo[]>('libraryPanels/search/folderFilterChanged');

export const libraryPanelsSearchReducer = (state: LibraryPanelsSearchState, action: AnyAction) => {
  if (searchChanged.match(action)) {
    return { ...state, searchQuery: action.payload };
  }

  if (sortChanged.match(action)) {
    return { ...state, sortDirection: action.payload.value };
  }

  if (panelFilterChanged.match(action)) {
    return { ...state, panelFilter: action.payload.map((p) => p.id) };
  }

  if (folderFilterChanged.match(action)) {
    return { ...state, folderFilter: action.payload.map((f) => String(f.id!)) };
  }

  return state;
};
