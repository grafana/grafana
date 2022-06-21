import { backendSrv } from 'app/core/services/backend_srv';

import { buildNavModel } from '../folders/state/navModel';

export const loadFolderPage = (uid: string) => {
  return backendSrv.getFolderByUid(uid).then((folder) => {
    const navModel = buildNavModel(folder);
    navModel.children![0].active = true;

    return { folder, folderNav: navModel };
  });
};
