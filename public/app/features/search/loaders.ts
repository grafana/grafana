import { NavModelItem } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';

import { buildNavModel } from '../folders/state/navModel';

export const loadFolderPage = async (uid: string) => {
  const folder = await backendSrv.getFolderByUid(uid, { withAccessControl: true });
  let parentItem: NavModelItem | undefined;
  if (folder.parentUid) {
    parentItem = (await loadFolderPage(folder.parentUid)).folderNav;
  }
  const navModel = buildNavModel(folder, parentItem);
  navModel.children![0].active = true;
  return { folder, folderNav: navModel };
};
