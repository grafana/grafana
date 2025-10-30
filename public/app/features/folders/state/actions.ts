import { getFolderByUidFacade } from 'app/api/clients/folder/v1beta1/hooks';
import { updateNavIndex } from 'app/core/actions';
import { FolderDTO } from 'app/types/folders';
import { ThunkResult } from 'app/types/store';

import { buildNavModel } from './navModel';
import { loadFolder } from './reducers';

export function getFolderByUid(uid: string): ThunkResult<Promise<FolderDTO>> {
  return async (dispatch) => {
    const folder = await getFolderByUidFacade(uid);
    dispatch(loadFolder(folder));
    dispatch(updateNavIndex(buildNavModel(folder)));
    return folder;
  };
}
