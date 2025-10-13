import { updateNavIndex } from 'app/core/actions';
import { backendSrv } from 'app/core/services/backend_srv';
import { buildNavModel } from 'app/features/folders/state/navModel';
import { store } from 'app/store/store';

export async function updateNavModel(folderUid: string) {
  try {
    const folder = await backendSrv.getFolderByUid(folderUid);
    store.dispatch(updateNavIndex(buildNavModel(folder)));
  } catch (err) {
    console.warn('Error fetching parent folder', folderUid, 'for dashboard', err);
  }
}
