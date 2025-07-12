import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { endpoints } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { FolderState, FolderDTO } from 'app/types/folders';

export const initialState: FolderState = {
  id: 0,
  uid: 'loading',
  title: 'loading',
  url: '',
  canSave: false,
  canDelete: false,
  hasChanged: false,
  version: 1,
};

const loadFolderReducer = (state: FolderState, action: PayloadAction<FolderDTO>): FolderState => {
  return {
    ...state,
    ...action.payload,
    hasChanged: false,
  };
};

const folderSlice = createSlice({
  name: 'folder',
  initialState,
  reducers: {
    loadFolder: loadFolderReducer,
    setFolderTitle: (state, action: PayloadAction<string>): FolderState => {
      return {
        ...state,
        title: action.payload,
        hasChanged: action.payload.trim().length > 0,
      };
    },
  },
  extraReducers: (builder) => {
    builder.addMatcher(endpoints.getFolder.matchFulfilled, loadFolderReducer);
  },
});

export const { loadFolder, setFolderTitle } = folderSlice.actions;

export const folderReducer = folderSlice.reducer;

export default {
  folder: folderReducer,
};
