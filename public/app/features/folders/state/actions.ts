import { getBackendSrv } from 'app/core/services/backend_srv';
import { StoreState } from 'app/types';
import { ThunkAction } from 'redux-thunk';
import { FolderDTO, FolderState } from 'app/types';
import {
  DashboardAcl,
  DashboardAclDTO,
  PermissionLevel,
  DashboardAclUpdateDTO,
  NewDashboardAclItem,
} from 'app/types/acl';

import { updateNavIndex, updateLocation } from 'app/core/actions';
import { buildNavModel } from './navModel';
import appEvents from 'app/core/app_events';

export enum ActionTypes {
  LoadFolder = 'LOAD_FOLDER',
  SetFolderTitle = 'SET_FOLDER_TITLE',
  SaveFolder = 'SAVE_FOLDER',
  LoadFolderPermissions = 'LOAD_FOLDER_PERMISSONS',
}

export interface LoadFolderAction {
  type: ActionTypes.LoadFolder;
  payload: FolderDTO;
}

export interface SetFolderTitleAction {
  type: ActionTypes.SetFolderTitle;
  payload: string;
}

export interface LoadFolderPermissionsAction {
  type: ActionTypes.LoadFolderPermissions;
  payload: DashboardAcl[];
}

export type Action = LoadFolderAction | SetFolderTitleAction | LoadFolderPermissionsAction;

type ThunkResult<R> = ThunkAction<R, StoreState, undefined, any>;

export const loadFolder = (folder: FolderDTO): LoadFolderAction => ({
  type: ActionTypes.LoadFolder,
  payload: folder,
});

export const setFolderTitle = (newTitle: string): SetFolderTitleAction => ({
  type: ActionTypes.SetFolderTitle,
  payload: newTitle,
});

export const loadFolderPermissions = (items: DashboardAclDTO[]): LoadFolderPermissionsAction => ({
  type: ActionTypes.LoadFolderPermissions,
  payload: items,
});

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

export function getFolderPermissions(uid: string): ThunkResult<void> {
  return async dispatch => {
    const permissions = await getBackendSrv().get(`/api/folders/${uid}/permissions`);
    dispatch(loadFolderPermissions(permissions));
  };
}

function toUpdateItem(item: DashboardAcl): DashboardAclUpdateDTO {
  return {
    userId: item.userId,
    teamId: item.teamId,
    role: item.role,
    permission: item.permission,
  };
}

export function updateFolderPermission(itemToUpdate: DashboardAcl, level: PermissionLevel): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const folder = getStore().folder;
    const itemsToUpdate = [];

    for (const item of folder.permissions) {
      if (item.inherited) {
        continue;
      }

      const updated = toUpdateItem(item);

      // if this is the item we want to update, update it's permission
      if (itemToUpdate === item) {
        updated.permission = level;
      }

      itemsToUpdate.push(updated);
    }

    await getBackendSrv().post(`/api/folders/${folder.uid}/permissions`, { items: itemsToUpdate });
    await dispatch(getFolderPermissions(folder.uid));
  };
}

export function removeFolderPermission(itemToDelete: DashboardAcl): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const folder = getStore().folder;
    const itemsToUpdate = [];

    for (const item of folder.permissions) {
      if (item.inherited || item === itemToDelete) {
        continue;
      }
      itemsToUpdate.push(toUpdateItem(item));
    }

    await getBackendSrv().post(`/api/folders/${folder.uid}/permissions`, { items: itemsToUpdate });
    await dispatch(getFolderPermissions(folder.uid));
  };
}

export function addFolderPermission(newItem: NewDashboardAclItem): ThunkResult<void> {
  return async (dispatch, getStore) => {
    const folder = getStore().folder;
    const itemsToUpdate = [];

    for (const item of folder.permissions) {
      if (item.inherited) {
        continue;
      }
      itemsToUpdate.push(toUpdateItem(item));
    }

    itemsToUpdate.push({
      userId: newItem.userId,
      teamId: newItem.teamId,
      role: newItem.role,
      permission: newItem.permission,
    });

    await getBackendSrv().post(`/api/folders/${folder.uid}/permissions`, { items: itemsToUpdate });
    await dispatch(getFolderPermissions(folder.uid));
  };
}
