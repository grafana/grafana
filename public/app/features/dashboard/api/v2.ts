import { UrlQueryMap } from '@grafana/data';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { backendSrv } from 'app/core/services/backend_srv';
import { getMessageFromError, getStatusFromError } from 'app/core/utils/errors';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import {
  AnnoKeyFolder,
  AnnoKeyFolderId,
  AnnoKeyFolderTitle,
  AnnoKeyFolderUrl,
  ResourceClient,
} from 'app/features/apiserver/types';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { DashboardDTO, SaveDashboardResponseDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { ResponseTransformers } from './ResponseTransformers';
import { DashboardAPI, DashboardWithAccessInfo } from './types';

export class K8sDashboardV2API implements DashboardAPI<DashboardWithAccessInfo<DashboardV2Spec> | DashboardDTO> {
  private client: ResourceClient<DashboardV2Spec>;

  constructor(private convertToV1: boolean) {
    this.client = new ScopedResourceClient<DashboardV2Spec>({
      group: 'dashboard.grafana.app',
      version: 'v2alpha1',
      resource: 'dashboards',
    });
  }

  async getDashboardDTO(uid: string, params?: UrlQueryMap) {
    try {
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
          throw new Error('Failed to load folder');
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
    } catch (e) {
      const status = getStatusFromError(e);
      const message = getMessageFromError(e);
      // Hacking around a bug in k8s api server that returns 500 for not found resources
      if (message.includes('not found') && status !== 404) {
        // @ts-expect-error
        e.status = 404;
        // @ts-expect-error
        e.data.message = 'Dashboard not found';
      }

      throw e;
    }
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse> {
    throw new Error('Method not implemented.');
  }

  saveDashboard(options: SaveDashboardCommand): Promise<SaveDashboardResponseDTO> {
    throw new Error('Method not implemented.');
  }
}
