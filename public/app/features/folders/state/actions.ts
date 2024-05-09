// @todo: replace barrel import path
import { updateNavIndex } from 'app/core/actions/index';
import { backendSrv } from 'app/core/services/backend_srv';
// @todo: replace barrel import path
import { FolderDTO, ThunkResult } from 'app/types/index';

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
