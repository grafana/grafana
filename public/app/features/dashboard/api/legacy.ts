import { AppEvents, UrlQueryMap } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FetchError, getBackendSrv } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import appEvents from 'app/core/app_events';
import { Resource, ResourceList } from 'app/features/apiserver/types';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { SaveDashboardResponseDTO, DashboardDTO } from 'app/types/dashboard';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { DashboardAPI, ListDeletedDashboardsOptions } from './types';

export class LegacyDashboardAPI implements DashboardAPI<DashboardDTO, Dashboard> {
  constructor() {}

  saveDashboard(options: SaveDashboardCommand<Dashboard>): Promise<SaveDashboardResponseDTO> {
    dashboardWatcher.ignoreNextSave();

    return getBackendSrv().post<SaveDashboardResponseDTO>('/api/dashboards/db/', {
      dashboard: options.dashboard,
      message: options.message ?? '',
      overwrite: options.overwrite ?? false,
      folderUid: options.folderUid,
    });
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse> {
    return getBackendSrv().delete<DeleteDashboardResponse>(`/api/dashboards/uid/${uid}`, undefined, {
      showSuccessAlert,
      validatePath: true,
    });
  }

  async getDashboardDTO(uid: string, params?: UrlQueryMap) {
    const result = await getBackendSrv().get<DashboardDTO>(`/api/dashboards/uid/${uid}`, params, undefined, {
      validatePath: true,
    });

    if (result.meta.isFolder) {
      appEvents.emit(AppEvents.alertError, ['Dashboard not found']);
      const fetchError: FetchError = {
        status: 404,
        config: { url: `/api/dashboards/uid/${uid}` },
        data: {
          message: t('dashboard.legacy-dashboard-api.fetch-error.message.dashboard-not-found', 'Dashboard not found'),
        },
      };
      throw fetchError;
    }

    return result;
  }

  /**
   * No-op for legacy API
   */
  listDeletedDashboards(options: ListDeletedDashboardsOptions): Promise<ResourceList<Dashboard>> {
    return Promise.resolve({
      apiVersion: 'v1',
      kind: 'List',
      metadata: { resourceVersion: '0' },
      items: [],
    });
  }

  /**
   * No-op for legacy API
   */
  restoreDashboard(dashboard: Resource<Dashboard>): Promise<Resource<Dashboard>> {
    return Promise.reject(new Error('Restore functionality not supported in legacy API'));
  }
}
