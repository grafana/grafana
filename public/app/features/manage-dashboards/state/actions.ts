import { getBackendSrv } from 'app/core/services/backend_srv';
import { StoreState } from 'app/types';
import { ThunkAction } from 'redux-thunk';
import { FolderDTO } from 'app/types';

export enum ActionTypes {
  LoadFolder = 'LOAD_FOLDER',
}

export interface LoadFolderAction {
  type: ActionTypes.LoadFolder;
  payload: FolderDTO;
}

export const loadFolder = (folder: FolderDTO): LoadFolderAction => ({
  type: ActionTypes.LoadFolder,
  payload: folder,
});

export type Action = LoadFolderAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, Action>;

export function getFolderByUid(uid: string): ThunkResult<void> {
  return async dispatch => {
    const folder = await getBackendSrv().getFolderByUid(uid);
    dispatch(loadFolder(folder));
  };
}
