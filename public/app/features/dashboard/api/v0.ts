import { locationUtil } from '@grafana/data';
import { backendSrv } from 'app/core/services/backend_srv';
import kbn from 'app/core/utils/kbn';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import {
  ResourceClient,
  ResourceForCreate,
  AnnoKeyMessage,
  AnnoKeyFolder,
  Resource,
} from 'app/features/apiserver/types';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { DashboardDataDTO, DashboardDTO, SaveDashboardResponseDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { DashboardAPI, DashboardWithAccessInfo } from './types';

export class K8sDashboardAPI implements DashboardAPI<DashboardDTO> {
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
      },
    };

    if (options.message) {
      obj.metadata.annotations = {
        ...obj.metadata.annotations,
        [AnnoKeyMessage]: options.message,
      };
    } else if (obj.metadata.annotations) {
      delete obj.metadata.annotations[AnnoKeyMessage];
    }

    if (options.folderUid) {
      obj.metadata.annotations = {
        ...obj.metadata.annotations,
        [AnnoKeyFolder]: options.folderUid,
      };
    }

    if (dashboard.uid) {
      obj.metadata.name = dashboard.uid;
      return this.client.update(obj).then((v) => this.asSaveDashboardResponseDTO(v));
    }
    return this.client.create(obj).then((v) => this.asSaveDashboardResponseDTO(v));
  }

  asSaveDashboardResponseDTO(v: Resource<DashboardDataDTO>): SaveDashboardResponseDTO {
    const url = locationUtil.assureBaseUrl(
      getDashboardUrl({
        uid: v.metadata.name,
        currentQueryParams: '',
        slug: kbn.slugifyForUrl(v.spec.title),
      })
    );

    return {
      uid: v.metadata.name,
      version: v.spec.version ?? 0,
      id: v.spec.id ?? 0,
      status: 'success',
      url,
      slug: '',
    };
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse> {
    return this.client.delete(uid).then((v) => ({
      id: 0,
      message: v.message,
      title: 'deleted',
    }));
  }

  async getDashboardDTO(uid: string) {
    const dash = await this.client.subresource<DashboardWithAccessInfo<DashboardDataDTO>>(uid, 'dto');

    const result: DashboardDTO = {
      meta: {
        ...dash.access,
        isNew: false,
        isFolder: false,
        uid: dash.metadata.name,
        k8s: dash.metadata,
        version: parseInt(dash.metadata.resourceVersion, 10),
      },
      dashboard: dash.spec,
    };

    if (dash.metadata.annotations?.[AnnoKeyFolder]) {
      try {
        const folder = await backendSrv.getFolderByUid(dash.metadata.annotations[AnnoKeyFolder]);
        result.meta.folderTitle = folder.title;
        result.meta.folderUrl = folder.url;
        result.meta.folderUid = folder.uid;
        result.meta.folderId = folder.id;
      } catch (e) {
        console.error('Failed to load a folder', e);
      }
    }

    return result;
  }
}
