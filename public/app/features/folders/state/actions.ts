import { locationUtil } from '@grafana/data';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { notifyApp, updateNavIndex } from 'app/core/actions';
import { createSuccessNotification } from 'app/core/copy/appNotification';
import { contextSrv } from 'app/core/core';
import { backendSrv } from 'app/core/services/backend_srv';
import { FolderDTO, FolderState, ThunkResult } from 'app/types';

import { buildNavModel } from './navModel';
import { loadFolder } from './reducers';

export function getFolderByUid(uid: string): ThunkResult<Promise<FolderDTO>> {
  return async (dispatch) => {
    const folder = await backendSrv.getFolderByUid(uid);
    dispatch(loadFolder(folder));
    dispatch(updateNavIndex(buildNavModel(folder)));
    return folder;
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

export function createNewFolder(folderName: string, uid?: string): ThunkResult<void> {
  return async (dispatch) => {
    const newFolder = await getBackendSrv().post('/api/folders', { title: folderName, parentUid: uid });
    await contextSrv.fetchUserPermissions();
    dispatch(notifyApp(createSuccessNotification('Folder Created', 'OK')));
    locationService.push(locationUtil.stripBaseFromUrl(newFolder.url));
  };
}
