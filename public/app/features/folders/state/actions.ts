import { getBackendSrv } from 'app/core/services/backend_srv';
import { StoreState } from 'app/types';
import { ThunkAction } from 'redux-thunk';
import { FolderDTO, FolderState } from 'app/types';
import { updateNavIndex, updateLocation } from 'app/core/actions';
import { buildNavModel } from './navModel';
import appEvents from 'app/core/app_events';

export enum ActionTypes {
  LoadFolder = 'LOAD_FOLDER',
  SetFolderTitle = 'SET_FOLDER_TITLE',
  SaveFolder = 'SAVE_FOLDER',
}

export interface LoadFolderAction {
  type: ActionTypes.LoadFolder;
  payload: FolderDTO;
}

export interface SetFolderTitleAction {
  type: ActionTypes.SetFolderTitle;
  payload: string;
}

export const loadFolder = (folder: FolderDTO): LoadFolderAction => ({
  type: ActionTypes.LoadFolder,
  payload: folder,
});

export const setFolderTitle = (newTitle: string): SetFolderTitleAction => ({
  type: ActionTypes.SetFolderTitle,
  payload: newTitle,
});

export type Action = LoadFolderAction | SetFolderTitleAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, any>;


export function getFolderByUid(uid: string): ThunkResult<void> {
  return async dispatch => {
    const folder = await getBackendSrv().getFolderByUid(uid);
    dispatch(loadFolder(folder));
    dispatch(updateNavIndex(buildNavModel(folder)));
  };
}

export function saveFolder(folder: FolderState): ThunkResult<void> {
  return async dispatch => {
    const res = await getBackendSrv().put(`/api/folders/${folder.uid}`, {
      title: folder.title,
      version: folder.version,
    });

    // this should be redux action at some point
    appEvents.emit('alert-success', ['Folder saved']);

    dispatch(updateLocation({ path: `${res.url}/settings` }));
  };
}

export function deleteFolder(uid: string): ThunkResult<void> {
  return async dispatch => {
    await getBackendSrv().deleteFolder(uid, true);
    dispatch(updateLocation({ path: `dashboards` }));
  };
}
