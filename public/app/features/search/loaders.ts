import { getFolderService } from '../folders/api';
import { buildNavModel } from '../folders/state/navModel';

export const loadFolderPage = (uid: string) => {
  return getFolderService()
    .getFolderDTOByUid(uid, { withAccessControl: true })
    .then((folder) => {
      const navModel = buildNavModel(folder);
      navModel.children![0].active = true;

      return { folder, folderNav: navModel };
    });
};
