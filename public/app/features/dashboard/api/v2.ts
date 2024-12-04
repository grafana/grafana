import { UrlQueryMap } from '@grafana/data';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { backendSrv } from 'app/core/services/backend_srv';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import {
  AnnoKeyFolder,
  AnnoKeyFolderId,
  AnnoKeyFolderTitle,
  AnnoKeyFolderUrl,
  ResourceClient,
} from 'app/features/apiserver/types';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { SaveDashboardResponseDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { ResponseTransformers } from './ResponseTransformers';
import { DashboardAPI, DashboardWithAccessInfo } from './types';

export class K8sDashboardV2APIStub implements DashboardAPI<DashboardWithAccessInfo<DashboardV2Spec>> {
  private client: ResourceClient<DashboardV2Spec>;

  constructor() {
    this.client = new ScopedResourceClient<DashboardV2Spec>({
      group: 'dashboard.grafana.app',
      version: 'v2alpha1',
      resource: 'dashboards',
    });
  }

  async getDashboardDTO(uid: string, params?: UrlQueryMap) {
    const dashboard = await this.client.subresource<DashboardWithAccessInfo<DashboardV2Spec>>(uid, 'dto');

    // For dev purposes only, the conversion should and will happen in the API. This is just to stub v2 api responses.
    const result = ResponseTransformers.transformV1ToV2(dashboard);
    if (result.metadata.annotations && result.metadata.annotations[AnnoKeyFolder]) {
      try {
        const folder = await backendSrv.getFolderByUid(result.metadata.annotations[AnnoKeyFolder]);
        result.metadata.annotations[AnnoKeyFolderTitle] = folder.title;
        result.metadata.annotations[AnnoKeyFolderUrl] = folder.url;
        result.metadata.annotations[AnnoKeyFolderId] = folder.id;
      } catch (e) {
        console.error('Failed to load a folder', e);
      }
    }

    return result;
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse> {
    throw new Error('Method not implemented.');
  }

  saveDashboard(options: SaveDashboardCommand): Promise<SaveDashboardResponseDTO> {
    throw new Error('Method not implemented.');
  }
}
