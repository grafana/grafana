import { UrlQueryMap } from '@grafana/data';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0/dashboard.gen';
import { backendSrv } from 'app/core/services/backend_srv';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import {
  AnnoKeyFolder,
  AnnoKeyFolderId,
  AnnoKeyFolderTitle,
  AnnoKeyFolderUrl,
  AnnoKeyMessage,
  ResourceClient,
  ResourceForCreate,
} from 'app/features/apiserver/types';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { DashboardDTO, SaveDashboardResponseDTO } from 'app/types';

import { SaveDashboardCommand, SaveDashboardCommandV2 } from '../components/SaveDashboard/types';

import { ResponseTransformers } from './ResponseTransformers';
import { DashboardAPI, DashboardWithAccessInfo } from './types';

export class K8sDashboardV2APIStub implements DashboardAPI<DashboardWithAccessInfo<DashboardV2Spec> | DashboardDTO> {
  private client: ResourceClient<DashboardV2Spec>;

  constructor(private convertToV1: boolean) {
    this.client = new ScopedResourceClient<DashboardV2Spec>({
      group: 'dashboard.grafana.app',
      version: 'v2alpha1',
      resource: 'dashboards',
    });
  }

  async getDashboardDTO(uid: string, params?: UrlQueryMap) {
    const dashboard = await this.client.subresource<DashboardWithAccessInfo<DashboardV2Spec>>(uid, 'dto');

    let result: DashboardWithAccessInfo<DashboardV2Spec> | DashboardDTO | undefined;

    // TODO: For dev purposes only, the conversion should and will happen in the API. This is just to stub v2 api responses.
    result = ResponseTransformers.ensureV2Response(dashboard);

    // load folder info if available
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

    // Depending on the ui components readiness, we might need to convert the response to v1
    if (this.convertToV1) {
      // Always return V1 format
      result = ResponseTransformers.ensureV1Response(result);
      return result;
    }
    // return the v2 response
    return result;
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse> {
    throw new Error('Method not implemented.');
  }

  async saveDashboard(options: SaveDashboardCommandV2): Promise<SaveDashboardResponseDTO> {
    const dashboard = options.dashboard;

    const obj: ResourceForCreate<DashboardV2Spec> = {
      // the metadata will have the name that's the uid
      metadata: {
        ...options?.k8s,
      },
      spec: {
        ...dashboard,
      },
    };

    // add annotations
    if (options.message) {
      obj.metadata.annotations = {
        ...obj.metadata.annotations,
        [AnnoKeyMessage]: options.message,
      };
    } else if (obj.metadata.annotations) {
      delete obj.metadata.annotations[AnnoKeyMessage];
    }

    // add folder annotation
    if (options.folderUid) {
      obj.metadata.annotations = {
        ...obj.metadata.annotations,
        [AnnoKeyFolder]: options.folderUid,
      };
    }

    // check we have the uid from metadata

    const uid = obj.metadata.name;

    if (!uid) {
      throw new Error('Dashboard uid is required');
    }

    const savedDashboard = await this.client.create(obj);
    console.log('dashboard is saved in backend!', savedDashboard);
  }
}
