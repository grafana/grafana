import { config, getBackendSrv } from '@grafana/runtime';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import { AnnoKeyFolder, AnnoKeyMessage, Resource, ResourceClient, ResourceForCreate } from 'app/features/apiserver/types';
import { SaveDashboardCommand } from 'app/features/dashboard/components/SaveDashboard/types';
import { dashboardWatcher } from 'app/features/live/dashboard/dashboardWatcher';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { DashboardDTO, DashboardDataDTO, SaveDashboardResponseDTO } from 'app/types';

import { getScopesFromUrl } from '../utils/getScopesFromUrl';

export interface DashboardAPI {
  /** Get a dashboard with the access control metadata */
  getDashboardDTO(uid: string): Promise<DashboardDTO>;
  /** Save dashboard */
  saveDashboard(options: SaveDashboardCommand): Promise<SaveDashboardResponseDTO>;
  /** Delete a dashboard */
  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse>;
}

// Implemented using /api/dashboards/*
class LegacyDashboardAPI implements DashboardAPI {
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

  getDashboardDTO(uid: string): Promise<DashboardDTO> {
    const scopesSearchParams = getScopesFromUrl();
    const scopes = scopesSearchParams?.getAll('scopes') ?? [];
    const queryParams = scopes.length > 0 ? { scopes } : undefined;

    return getBackendSrv().get<DashboardDTO>(`/api/dashboards/uid/${uid}`, queryParams);
  }
}

// Implemented using /apis/dashboards.grafana.app/*
class K8sDashboardAPI implements DashboardAPI {
  private client: ResourceClient<DashboardDataDTO>;

  constructor() {
    this.client = new ScopedResourceClient<DashboardDataDTO>({
      group: 'dashboard.grafana.app',
      version: 'v0alpha1',
      resource: 'dashboards',
    });
  }

  saveDashboard(options: SaveDashboardCommand): Promise<SaveDashboardResponseDTO> {
    const dashboard = options.dashboard as DashboardDataDTO; // type for the uid property
    const obj: ResourceForCreate<DashboardDataDTO> = {
      metadata: {
        ...options?.k8s,
      },
      spec: {
        ...dashboard,
      }
    }
    if (options.message) {
      obj.metadata.annotations = {
        ...obj.metadata.annotations,
        [AnnoKeyMessage]: options.message,
      };
    }
    if (options.folderUid) {
      obj.metadata.annotations = {
        ...obj.metadata.annotations,
        [AnnoKeyFolder]: options.folderUid,
      };
    }

    if (dashboard.uid) {
      obj.metadata.name = dashboard.uid;
      return this.client.update(obj).then(v => this.asSaveDashboardResponseDTO(v))
    } 
    return this.client.create(obj).then(v => this.asSaveDashboardResponseDTO(v))
  }

  asSaveDashboardResponseDTO(v: Resource<DashboardDataDTO>): SaveDashboardResponseDTO {
    // console.log("RAW", v);
    return {
      uid: v.metadata.name,
      version: v.spec.version ?? 0,
      id: v.spec.id ?? 0,
      status: '',
      slug: '',
      url: '',
    }
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse> {
    return this.client.delete(uid).then(v => ({
      id: 123,
      message: v.message,
      title: 'deleted',
    }));
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
        k8s: d.metadata,
      },
      dashboard: d.spec,
    };
  }
}

let instance: DashboardAPI | undefined = undefined;

export function getDashboardAPI() {
  if (!instance) {
    const legacy = new LegacyDashboardAPI();
    instance = config.featureToggles.kubernetesDashboards ? new K8sDashboardAPI() : legacy;
  }
  return instance;
}

export function setDashboardAPI(override: DashboardAPI | undefined) {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('dashboardAPI can be only overridden in test environment');
  }
  instance = override;
}
