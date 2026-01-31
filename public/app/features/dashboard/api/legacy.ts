import { AppEvents, UrlQueryMap } from '@grafana/data';
import { t } from '@grafana/i18n';
import { FetchError, getBackendSrv } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { appEvents } from 'app/core/app_events';
import { Resource, ResourceList } from 'app/features/apiserver/types';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { SaveDashboardResponseDTO, DashboardDTO } from 'app/types/dashboard';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { DashboardAPI, ListDashboardHistoryOptions, ListDeletedDashboardsOptions } from './types';

interface HistoryResult {
  continueToken?: string;
  versions: RevisionsModel[];
}
interface RevisionsModel {
  id: number;
  checked: boolean;
  uid: string;
  parentVersion: number;
  version: number;
  created: Date;
  createdBy: string;
  message: string;
  data: Dashboard;
}

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

  async listDashboardHistory(uid: string, options?: ListDashboardHistoryOptions) {
    const params = {
      limit: options?.limit ?? 10,
      continueToken: options?.continueToken,
    };
    const result = await getBackendSrv().get<HistoryResult>(`/api/dashboards/uid/${uid}/versions`, params);
    return {
      apiVersion: 'v0alpha1',
      kind: 'DashboardList',
      metadata: {
        resourceVersion: '0',
        continue: result.continueToken,
      },
      items: result.versions.map((v) => ({
        apiVersion: 'v0alpha1',
        kind: 'Dashboard',
        metadata: {
          name: v.uid,
          resourceVersion: v.version.toString(),
          generation: v.version,
          creationTimestamp: v.created ? String(v.created) : new Date().toISOString(),
          annotations: {
            'grafana.app/updatedBy': v.createdBy,
            'grafana.app/message': v.message,
          },
        },
        spec: v.data,
      })),
    };
  }

  async getDashboardHistoryVersions(uid: string, versions: number[]): Promise<Array<Resource<Dashboard>>> {
    const requests = versions.map((version) =>
      getBackendSrv().get<RevisionsModel>(`/api/dashboards/uid/${uid}/versions/${version}`)
    );
    const results = await Promise.all(requests);

    return results.map((result) => ({
      apiVersion: 'v0alpha1',
      kind: 'Dashboard',
      metadata: {
        name: result.uid,
        resourceVersion: result.version.toString(),
        generation: result.version,
        creationTimestamp: result.created ? String(result.created) : new Date().toISOString(),
        annotations: {
          'grafana.app/updatedBy': result.createdBy,
          'grafana.app/message': result.message,
        },
      },
      spec: result.data,
    }));
  }

  async restoreDashboardVersion(uid: string, version: number): Promise<SaveDashboardResponseDTO> {
    const [historicalVersion] = await this.getDashboardHistoryVersions(uid, [version]);
    return await this.saveDashboard({
      dashboard: {
        ...historicalVersion.spec,
        uid,
      },
      message: `Restored from version ${version}`,
      overwrite: true,
    });
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
