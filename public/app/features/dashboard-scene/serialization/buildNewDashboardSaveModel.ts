import { defaultDashboard } from '@grafana/schema';
import { DashboardDTO } from 'app/types';

export function buildNewDashboardSaveModel(urlFolderUid?: string): DashboardDTO {
  const data: DashboardDTO = {
    meta: {
      canStar: false,
      canShare: false,
      canDelete: false,
      isNew: true,
      folderUid: '',
    },
    dashboard: {
      ...defaultDashboard,
      uid: '',
      title: 'New dashboard',
      panels: [],
    },
  };

  if (urlFolderUid) {
    data.meta.folderUid = urlFolderUid;
  }

  return data;
}
