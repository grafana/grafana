import { AppEvents } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import { FolderState, ThunkResult } from 'app/types';
import { DashboardAcl, DashboardAclUpdateDTO, NewDashboardAclItem, PermissionLevel } from 'app/types/acl';

import { updateLocation, updateNavIndex } from 'app/core/actions';
import { buildNavModel } from './navModel';
import appEvents from 'app/core/app_events';
import { loadFolder, loadFolderPermissions } from './reducers';

export function getFolderByUid(uid: string): ThunkResult<void> {
  return async dispatch => {
    const folder = await backendSrv.getFolderByUid(uid);
    dispatch(loadFolder(folder));
    dispatch(updateNavIndex(buildNavModel(folder)));
  };
}

export function saveFolder(folder: FolderState): ThunkResult<void> {
  return async dispatch => {
    const res = await backendSrv.put(`/api/folders/${folder.uid}`, {
      title: folder.title,
      version: folder.version,
    });

    // this should be redux action at some point
    appEvents.emit(AppEvents.alertSuccess, ['Folder saved']);

    dispatch(updateLocation({ path: `${res.url}/settings` }));
  };
}

export function deleteFolder(uid: string): ThunkResult<void> {
  return async dispatch => {
    await backendSrv.deleteFolder(uid, true);
    dispatch(updateLocation({ path: `dashboards` }));
  };
}

export function getFolderPermissions(uid: string): ThunkResult<void> {
  return async dispatch => {
    const permissions = await backendSrv.get(`/api/folders/${uid}/permissions`);
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

    await backendSrv.post(`/api/folders/${folder.uid}/permissions`, { items: itemsToUpdate });
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

    await backendSrv.post(`/api/folders/${folder.uid}/permissions`, { items: itemsToUpdate });
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

    await backendSrv.post(`/api/folders/${folder.uid}/permissions`, { items: itemsToUpdate });
    await dispatch(getFolderPermissions(folder.uid));
  };
}
