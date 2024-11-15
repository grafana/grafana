import { UrlQueryMap } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { DashboardDataDTO, SaveDashboardResponseDTO, DashboardDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { DashboardAPI } from './types';

export class LegacyDashboardAPI implements DashboardAPI<DashboardDataDTO> {
  constructor() {}

  saveDashboard(options: SaveDashboardCommand): Promise<SaveDashboardResponseDTO> {
    dashboardWatcher.ignoreNextSave();

    return getBackendSrv().post<SaveDashboardResponseDTO>('/api/dashboards/db/', {
      dashboard: options.dashboard,
      message: options.message ?? '',
      overwrite: options.overwrite ?? false,
      folderUid: options.folderUid,
    });
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse> {
    return getBackendSrv().delete<DeleteDashboardResponse>(`/api/dashboards/uid/${uid}`, { showSuccessAlert });
  }

  async getDashboardDTO(uid: string, params?: UrlQueryMap) {
    return await getBackendSrv().get<DashboardDTO>(`/api/dashboards/uid/${uid}`, params);
  }
}
