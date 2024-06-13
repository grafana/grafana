import { UrlQueryMap } from '@grafana/data';
import { config, getBackendSrv } from '@grafana/runtime';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import { ResourceClient } from 'app/features/apiserver/types';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { DashboardDTO, DashboardDataDTO } from 'app/types';

export interface DashboardAPI {
  /** Get a dashboard with the access control metadata */
  getDashboardDTO(uid: string, queryParams?: UrlQueryMap | undefined): Promise<DashboardDTO>;
  /** Save dashboard */
  saveDashboard(options: SaveDashboardCommand): Promise<unknown>;
  /** Delete a dashboard */
  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse>;
}

// Implemented using /api/dashboards/*
class LegacyDashboardAPI implements DashboardAPI {
  constructor() {}

  saveDashboard(options: SaveDashboardCommand): Promise<unknown> {
    dashboardWatcher.ignoreNextSave();

    return getBackendSrv().post('/api/dashboards/db/', {
      dashboard: options.dashboard,
      message: options.message ?? '',
      overwrite: options.overwrite ?? false,
      folderUid: options.folderUid,
    });
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse> {
    return getBackendSrv().delete<DeleteDashboardResponse>(`/api/dashboards/uid/${uid}`, { showSuccessAlert });
  }

  getDashboardDTO(uid: string, queryParams?: UrlQueryMap | undefined): Promise<DashboardDTO> {
    return getBackendSrv().get<DashboardDTO>(`/api/dashboards/uid/${uid}`, queryParams);
  }
}

// Implemented using /apis/dashboards.grafana.app/*
class K8sDashboardAPI implements DashboardAPI {
  private client: ResourceClient<DashboardDataDTO>;
  constructor(private legacy: DashboardAPI) {
    this.client = new ScopedResourceClient<DashboardDataDTO>({
      group: 'dashboard.grafana.app',
      version: 'v0alpha1',
      resource: 'dashboards',
    });
  }

  saveDashboard(options: SaveDashboardCommand): Promise<unknown> {
    return this.legacy.saveDashboard(options);
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse> {
    return this.legacy.deleteDashboard(uid, showSuccessAlert);
  }

  async getDashboardDTO(uid: string): Promise<DashboardDTO> {
    const d = await this.client.get(uid);
    const m = await this.client.subresource<object>(uid, 'access');
    return {
      meta: {
        ...m,
        isNew: false,
        isFolder: false,
        uid: d.metadata.name,
      },
      dashboard: d.spec,
    };
  }
}

let instance: DashboardAPI | undefined = undefined;

export function getDashboardAPI() {
  if (!instance) {
    const legacy = new LegacyDashboardAPI();
    instance = config.featureToggles.kubernetesDashboards ? new K8sDashboardAPI(legacy) : legacy;
  }
  return instance;
}
