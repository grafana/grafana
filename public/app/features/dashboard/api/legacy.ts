import { AppEvents, UrlQueryMap } from '@grafana/data';
import { getBackendSrv } from '@grafana/runtime';
import appEvents from 'app/core/app_events';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { SaveDashboardResponseDTO, DashboardDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { DashboardAPI } from './types';

export class LegacyDashboardAPI implements DashboardAPI<DashboardDTO> {
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
    const result = await getBackendSrv().get<DashboardDTO>(`/api/dashboards/uid/${uid}`, params);

    if (result.meta.isFolder) {
      appEvents.emit(AppEvents.alertError, ['Dashboard not found']);
      throw new Error('Dashboard not found');
    }

    return result;
  }
}
