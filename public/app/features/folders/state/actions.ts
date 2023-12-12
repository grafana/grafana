import { updateNavIndex } from 'app/core/actions';
import { FolderDTO, ThunkResult } from 'app/types';

import { getFolderService } from '../api';

import { buildNavModel } from './navModel';
import { loadFolder } from './reducers';

export function getFolderByUid(uid: string): ThunkResult<Promise<FolderDTO>> {
  return async (dispatch) => {
    const folder = await getFolderService().getFolderDTOByUid(uid);
    dispatch(loadFolder(folder));
    dispatch(updateNavIndex(buildNavModel(folder)));
    return folder;
  };
}
