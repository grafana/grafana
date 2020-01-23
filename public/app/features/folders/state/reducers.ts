import { createSlice, PayloadAction } from '@reduxjs/toolkit';

import { DashboardAclDTO, FolderDTO, FolderState } from 'app/types';
import { processAclItems } from 'app/core/utils/acl';

export const initialState: FolderState = {
  id: 0,
  uid: 'loading',
  title: 'loading',
  url: '',
  canSave: false,
  hasChanged: false,
  version: 1,
  permissions: [],
};

const folderSlice = createSlice({
  name: 'folder',
  initialState,
  reducers: {
    loadFolder: (state, action: PayloadAction<FolderDTO>): FolderState => {
      return {
        ...state,
        ...action.payload,
        hasChanged: false,
      };
    },
    setFolderTitle: (state, action: PayloadAction<string>): FolderState => {
      return {
        ...state,
        title: action.payload,
        hasChanged: action.payload.trim().length > 0,
      };
    },
    loadFolderPermissions: (state, action: PayloadAction<DashboardAclDTO[]>): FolderState => {
      return {
        ...state,
        permissions: processAclItems(action.payload),
      };
    },
  },
});

export const { loadFolderPermissions, loadFolder, setFolderTitle } = folderSlice.actions;

export const folderReducer = folderSlice.reducer;

export default {
  folder: folderReducer,
};
