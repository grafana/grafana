import { lastValueFrom } from 'rxjs';

import { locationUtil, NavModelItem } from '@grafana/data';
import { getBackendSrv, isFetchError, locationService } from '@grafana/runtime';
import { notifyApp, updateNavIndex } from 'app/core/actions';
import { createSuccessNotification, createWarningNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';
import { FolderState, ThunkResult } from 'app/types';
import { DashboardAcl, DashboardAclUpdateDTO, NewDashboardAclItem, PermissionLevel } from 'app/types/acl';

import { buildNavModel } from './navModel';
import { loadFolder, loadFolderPermissions, setCanViewFolderPermissions } from './reducers';

export function getFolderByUid(uid: string): ThunkResult<Promise<NavModelItem>> {
  return async (dispatch) => {
    const folder = await backendSrv.getFolderByUid(uid);
    dispatch(loadFolder(folder));
    let parentItem: NavModelItem | undefined;
    if (folder.parentUid) {
      parentItem = await dispatch(getFolderByUid(folder.parentUid));
    }
    const navModel = buildNavModel(folder, parentItem);
    dispatch(updateNavIndex(navModel));
    return navModel;
  };
}

export function saveFolder(folder: FolderState): ThunkResult<void> {
  return async (dispatch) => {
    const res = await backendSrv.put(`/api/folders/${folder.uid}`, {
      title: folder.title,
      version: folder.version,
    });

    dispatch(notifyApp(createSuccessNotification('Folder saved')));
    dispatch(loadFolder(res));
    locationService.push(locationUtil.stripBaseFromUrl(`${res.url}/settings`));
  };
}

export function deleteFolder(uid: string): ThunkResult<void> {
  return async () => {
    await backendSrv.delete(`/api/folders/${uid}?forceDeleteRules=false`);
    locationService.push('/dashboards');
  };
}

export function getFolderPermissions(uid: string): ThunkResult<void> {
  return async (dispatch) => {
    const permissions = await backendSrv.get(`/api/folders/${uid}/permissions`);
    dispatch(loadFolderPermissions(permissions));
  };
}

export function checkFolderPermissions(uid: string): ThunkResult<void> {
  return async (dispatch) => {
    try {
      await lastValueFrom(
        backendSrv.fetch({
          method: 'GET',
          showErrorAlert: false,
          showSuccessAlert: false,
          url: `/api/folders/${uid}/permissions`,
        })
      );
      dispatch(setCanViewFolderPermissions(true));
    } catch (err) {
      if (isFetchError(err) && err.status !== 403) {
        dispatch(notifyApp(createWarningNotification('Error checking folder permissions', err.data?.message)));
      }

      dispatch(setCanViewFolderPermissions(false));
    }
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

      // if this is the item we want to update, update its permission
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

export function createNewFolder(folderName: string, uid?: string): ThunkResult<void> {
  return async (dispatch) => {
    const newFolder = await getBackendSrv().post('/api/folders', { title: folderName, parentUid: uid });
    await contextSrv.fetchUserPermissions();
    dispatch(notifyApp(createSuccessNotification('Folder Created', 'OK')));
    locationService.push(locationUtil.stripBaseFromUrl(newFolder.url));
  };
}
