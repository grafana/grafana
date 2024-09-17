import { updateNavIndex } from 'app/core/actions';
import { backendSrv } from 'app/core/services/backend_srv';
import { FolderDTO, ThunkResult } from 'app/types';

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
