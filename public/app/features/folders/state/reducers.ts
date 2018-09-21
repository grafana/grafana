import { FolderState } from 'app/types';
import { Action, ActionTypes } from './actions';
import { processAclItems } from 'app/core/utils/acl';

export const inititalState: FolderState = {
  id: 0,
  uid: 'loading',
  title: 'loading',
  url: '',
  canSave: false,
  hasChanged: false,
  version: 1,
  permissions: [],
};

export const folderReducer = (state = inititalState, action: Action): FolderState => {
  switch (action.type) {
    case ActionTypes.LoadFolder:
      return {
        ...state,
        ...action.payload,
        hasChanged: false,
      };
    case ActionTypes.SetFolderTitle:
      return {
        ...state,
        title: action.payload,
        hasChanged: action.payload.trim().length > 0,
      };
    case ActionTypes.LoadFolderPermissions:
      return {
        ...state,
        permissions: processAclItems(action.payload),
      };
  }
  return state;
};

export default {
  folder: folderReducer,
};
