import { getBackendSrv } from '@grafana/runtime';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import { ResourceClient } from 'app/features/apiserver/types';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { DashboardDTO, DashboardDataDTO } from 'app/types';

export interface DashboardAPI {
  dashboardExists(uid: string): Promise<boolean>;
  getDashboardDTO(uid: string): Promise<DashboardDTO>;
  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse>;
  saveDashboard(options: SaveDashboardCommand): Promise<unknown>;
}

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

  dashboardExists(uid: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse> {
    return getBackendSrv().delete<DeleteDashboardResponse>(
      `/api/dashboards/uid/${uid}`, { showSuccessAlert });
  }

  getDashboardDTO(uid: string): Promise<DashboardDTO> {
    return getBackendSrv().get<DashboardDTO>(`/api/dashboards/uid/${uid}`);
  }
}

class K8sDashboardAPI implements DashboardAPI {
  private client: ResourceClient<DashboardDataDTO>;
  private legacy: DashboardAPI;

  constructor() {
    this.legacy = new LegacyDashboardAPI();
    this.client = new ScopedResourceClient<DashboardDataDTO>({
      group: 'dashboards.grafana.app',
      version: 'v0alpha1',
      resource: 'dashboards',
    });
  }

  saveDashboard(options: SaveDashboardCommand): Promise<unknown> {
    return this.legacy.saveDashboard(options);
  }

  async dashboardExists(uid: string): Promise<boolean> {
    try {
      const r = await this.client.get(uid);
      if (r.metadata.name) {
        return Promise.resolve(true);
      }
    } catch {}
    return Promise.resolve(false);
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse> {
    return this.legacy.deleteDashboard(uid, showSuccessAlert);
  }

  async getDashboardDTO(uid: string): Promise<DashboardDTO> {
    const d = await this.client.get(uid);
    const m = await this.client.subresource<object>(uid, 'meta');
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
    instance = false ? new K8sDashboardAPI() : new LegacyDashboardAPI();
  }
  return instance;
}
