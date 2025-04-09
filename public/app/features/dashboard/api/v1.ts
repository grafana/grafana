import { locationUtil } from '@grafana/data';
import { Dashboard } from '@grafana/schema';
import { backendSrv } from 'app/core/services/backend_srv';
import { getMessageFromError, getStatusFromError } from 'app/core/utils/errors';
import kbn from 'app/core/utils/kbn';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import {
  ResourceClient,
  ResourceForCreate,
  AnnoKeyMessage,
  AnnoKeyFolder,
  AnnoKeyGrantPermissions,
  Resource,
  DeprecatedInternalId,
} from 'app/features/apiserver/types';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { DashboardDataDTO, DashboardDTO, SaveDashboardResponseDTO } from 'app/types';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { DashboardAPI, DashboardVersionError, DashboardWithAccessInfo } from './types';

export class K8sDashboardAPI implements DashboardAPI<DashboardDTO, Dashboard> {
  private client: ResourceClient<DashboardDataDTO>;

  constructor() {
    this.client = new ScopedResourceClient<DashboardDataDTO>({
      group: 'dashboard.grafana.app',
      version: 'v1alpha1',
      resource: 'dashboards',
    });
  }

  saveDashboard(options: SaveDashboardCommand<Dashboard>): Promise<SaveDashboardResponseDTO> {
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

    // for v1 in g12, we will ignore the schema version validation from all default clients,
    // as we implement the necessary backend conversions, we will drop this query param
    if (dashboard.uid) {
      obj.metadata.name = dashboard.uid;
      return this.client.update(obj, { fieldValidation: 'Ignore' }).then((v) => this.asSaveDashboardResponseDTO(v));
    }
    obj.metadata.annotations = {
      ...obj.metadata.annotations,
      [AnnoKeyGrantPermissions]: 'default',
    };
    return this.client.create(obj, { fieldValidation: 'Ignore' }).then((v) => this.asSaveDashboardResponseDTO(v));
  }

  asSaveDashboardResponseDTO(v: Resource<DashboardDataDTO>): SaveDashboardResponseDTO {
    const url = locationUtil.assureBaseUrl(
      getDashboardUrl({
        uid: v.metadata.name,
        currentQueryParams: '',
        slug: kbn.slugifyForUrl(v.spec.title.trim()),
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
    return this.client.delete(uid, showSuccessAlert).then((v) => ({
      id: 0,
      message: v.message,
      title: 'deleted',
    }));
  }

  async getDashboardDTO(uid: string) {
    try {
      const dash = await this.client.subresource<DashboardWithAccessInfo<DashboardDataDTO>>(uid, 'dto');

      // This could come as conversion error from v0 or v2 to V1.
      if (dash.status?.conversion?.failed && dash.status.conversion.storedVersion === 'v2alpha1') {
        throw new DashboardVersionError(dash.status.conversion.storedVersion, dash.status.conversion.error);
      }

      const result: DashboardDTO = {
        meta: {
          ...dash.access,
          isNew: false,
          isFolder: false,
          uid: dash.metadata.name,
          k8s: dash.metadata,
          version: dash.metadata.generation,
        },
        dashboard: {
          ...dash.spec,
          version: dash.metadata.generation,
          uid: dash.metadata.name,
        },
      };

      if (dash.metadata.labels?.[DeprecatedInternalId]) {
        result.dashboard.id = parseInt(dash.metadata.labels[DeprecatedInternalId], 10);
      }

      if (dash.metadata.annotations?.[AnnoKeyFolder]) {
        try {
          const folder = await backendSrv.getFolderByUid(dash.metadata.annotations[AnnoKeyFolder]);
          result.meta.folderTitle = folder.title;
          result.meta.folderUrl = folder.url;
          result.meta.folderUid = folder.uid;
          result.meta.folderId = folder.id;
        } catch (e) {
          throw new Error('Failed to load folder');
        }
      }

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
}
