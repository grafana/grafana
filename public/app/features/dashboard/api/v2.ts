import { locationUtil, UrlQueryMap } from '@grafana/data';
import { DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2alpha0';
import { backendSrv } from 'app/core/services/backend_srv';
import { getMessageFromError, getStatusFromError } from 'app/core/utils/errors';
import kbn from 'app/core/utils/kbn';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import {
  AnnoKeyFolder,
  AnnoKeyFolderId,
  AnnoKeyFolderTitle,
  AnnoKeyFolderUrl,
  AnnoKeyMessage,
  DeprecatedInternalId,
  Resource,
  ResourceClient,
  ResourceForCreate,
} from 'app/features/apiserver/types';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { DashboardDTO, SaveDashboardResponseDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { ResponseTransformers } from './ResponseTransformers';
import { DashboardAPI, DashboardWithAccessInfo } from './types';

export class K8sDashboardV2API
  implements DashboardAPI<DashboardWithAccessInfo<DashboardV2Spec> | DashboardDTO, DashboardV2Spec>
{
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
      } else if (result.metadata.annotations && !result.metadata.annotations[AnnoKeyFolder]) {
        // Set AnnoKeyFolder to empty string for top-level dashboards
        // This ensures NestedFolderPicker correctly identifies it as being in the "Dashboard" root folder
        // AnnoKeyFolder undefined -> top-level dashboard -> empty string
        result.metadata.annotations[AnnoKeyFolder] = '';
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
    return this.client.delete(uid, showSuccessAlert).then((v) => ({
      id: 0,
      message: v.message,
      title: 'deleted',
    }));
  }

  async saveDashboard(options: SaveDashboardCommand<DashboardV2Spec>): Promise<SaveDashboardResponseDTO> {
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
      // remove frontend folder annotations
      delete obj.metadata.annotations?.[AnnoKeyFolderTitle];
      delete obj.metadata.annotations?.[AnnoKeyFolderUrl];
      delete obj.metadata.annotations?.[AnnoKeyFolderId];

      obj.metadata.annotations = {
        ...obj.metadata.annotations,
        [AnnoKeyFolder]: options.folderUid,
      };
    }

    if (obj.metadata.name) {
      // remove resource version when updating
      delete obj.metadata.resourceVersion;
      return this.client.update(obj).then((v) => this.asSaveDashboardResponseDTO(v));
    }
    return await this.client.create(obj).then((v) => this.asSaveDashboardResponseDTO(v));
  }

  asSaveDashboardResponseDTO(v: Resource<DashboardV2Spec>): SaveDashboardResponseDTO {
    const url = locationUtil.assureBaseUrl(
      getDashboardUrl({
        uid: v.metadata.name,
        currentQueryParams: '',
        slug: kbn.slugifyForUrl(v.spec.title),
      })
    );

    let dashId = 0;
    if (v.metadata.labels?.[DeprecatedInternalId]) {
      dashId = parseInt(v.metadata.labels[DeprecatedInternalId], 10);
    }

    return {
      uid: v.metadata.name,
      version: parseInt(v.metadata.resourceVersion, 10) ?? 0,
      id: dashId,
      status: 'success',
      url,
      slug: '',
    };
  }
}
