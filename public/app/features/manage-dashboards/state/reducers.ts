import { FolderState } from 'app/types';
import { Action, ActionTypes } from './actions';

export const inititalState: FolderState = null;

export const folderReducer = (state = inititalState, action: Action): FolderState => {
  switch (action.type) {
    case ActionTypes.LoadFolder:
      return {
        ...action.payload,
        canSave: false,
        hasChanged: false,
      };
  }
  return state;
};

export default {
  folder: folderReducer,
};
