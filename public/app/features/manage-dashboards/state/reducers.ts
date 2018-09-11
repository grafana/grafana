import { FolderState } from 'app/types';
import { Action, ActionTypes } from './actions';

export const inititalState: FolderState = {
  uid: 'loading',
  id: -1,
  title: 'loading',
  url: '',
  canSave: false,
  hasChanged: false,
  version: 0,
};

export const folderReducer = (state = inititalState, action: Action): FolderState => {
  switch (action.type) {
    case ActionTypes.LoadFolder:
      return {
        ...action.payload,
        hasChanged: false,
      };
    case ActionTypes.SetFolderTitle:
      return {
        ...state,
        title: action.payload,
        hasChanged: true,
      };
  }
  return state;
};

export default {
  folder: folderReducer,
};
