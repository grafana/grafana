import { locationUtil } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Dashboard } from '@grafana/schema';
import { Status } from '@grafana/schema/src/schema/dashboard/v2';
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
  AnnoKeyManagerKind,
  AnnoKeySourcePath,
  AnnoKeyManagerAllowsEdits,
  ManagerKind,
  AnnoReloadOnParamsChange,
} from 'app/features/apiserver/types';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';
import { DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { DashboardDataDTO, DashboardDTO, SaveDashboardResponseDTO } from 'app/types/dashboard';

import { SaveDashboardCommand } from '../components/SaveDashboard/types';

import { DashboardAPI, DashboardVersionError, DashboardWithAccessInfo, ListDeletedDashboardsOptions } from './types';
import { isV2StoredVersion } from './utils';

export const K8S_V1_DASHBOARD_API_CONFIG = {
  group: 'dashboard.grafana.app',
  version: 'v1beta1',
  resource: 'dashboards',
};

export class K8sDashboardAPI implements DashboardAPI<DashboardDTO, Dashboard> {
  private client: ResourceClient<DashboardDataDTO, Status>;

  constructor() {
    this.client = new ScopedResourceClient<DashboardDataDTO>(K8S_V1_DASHBOARD_API_CONFIG);
  }

  saveDashboard(options: SaveDashboardCommand<Dashboard>): Promise<SaveDashboardResponseDTO> {
    const dashboard = options.dashboard;
    const obj: ResourceForCreate<DashboardDataDTO> = {
      metadata: {
        ...options?.k8s,
      },
      spec: {
        ...dashboard,
        title: dashboard.title ?? '',
        uid: dashboard.uid ?? '',
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
      // remove resource version when updating
      delete obj.metadata.resourceVersion;
      return this.client.update(obj, { fieldValidation: 'Ignore' }).then((v) => this.asSaveDashboardResponseDTO(v));
    }
    obj.metadata.annotations = {
      ...obj.metadata.annotations,
      [AnnoKeyGrantPermissions]: 'default',
    };
    return this.client.create(obj, { fieldValidation: 'Ignore' }).then((v) => this.asSaveDashboardResponseDTO(v));
  }

  asSaveDashboardResponseDTO(v: Resource<DashboardDataDTO>): SaveDashboardResponseDTO {
    const slug = kbn.slugifyForUrl(v.spec.title.trim());

    const url = locationUtil.assureBaseUrl(
      getDashboardUrl({
        uid: v.metadata.name,
        currentQueryParams: '',
        slug,
      })
    );

    return {
      uid: v.metadata.name,
      version: v.metadata.generation ?? 0,
      id: v.spec.id ?? 0,
      status: 'success',
      url,
      slug,
    };
  }

  deleteDashboard(uid: string, showSuccessAlert: boolean): Promise<DeleteDashboardResponse> {
    return this.client.delete(uid, showSuccessAlert).then((v) => ({
      id: 0,
      message: v.message,
      title: t('dashboard.k8s-dashboard-api.title.deleted', 'deleted'),
    }));
  }

  async getDashboardDTO(uid: string) {
    try {
      const dash = await this.client.subresource<DashboardWithAccessInfo<DashboardDataDTO>>(uid, 'dto');

      // This could come as conversion error from v0 or v2 to V1.
      if (dash.status?.conversion?.failed && isV2StoredVersion(dash.status.conversion.storedVersion)) {
        throw new DashboardVersionError(dash.status.conversion.storedVersion, dash.status.conversion.error);
      }

      const result: DashboardDTO = {
        meta: {
          ...dash.access,
          slug: kbn.slugifyForUrl(dash.spec.title.trim()),
          isNew: false,
          isFolder: false,
          uid: dash.metadata.name,
          k8s: dash.metadata,
          version: dash.metadata.generation,
          created: dash.metadata.creationTimestamp,
        },
        dashboard: {
          ...dash.spec,
          version: dash.metadata.generation,
          uid: dash.metadata.name,
        },
      };

      /** @experimental only provided by proxies for setup with reloadDashboardsOnParamsChange toggle on */
      /** Not intended to be used in production, we will be removing this in short-term future */
      if (dash.metadata.annotations?.[AnnoReloadOnParamsChange]) {
        result.meta.reloadOnParamsChange = true;
      }

      const annotations = dash.metadata.annotations ?? {};
      const managerKind = annotations[AnnoKeyManagerKind];

      if (managerKind) {
        result.meta.provisioned = annotations[AnnoKeyManagerAllowsEdits] === 'true' || managerKind === ManagerKind.Repo;
        result.meta.provisionedExternalId = annotations[AnnoKeySourcePath];
      }

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
          // If user has access to dashboard but not to folder, continue without folder info
          if (getStatusFromError(e) !== 403) {
            throw new Error('Failed to load folder');
          }
          // we still want to save the folder uid so that we can properly handle disabling the folder picker in Settings -> General
          // this is an edge case when user has edit access to a dashboard but doesn't have access to the folder
          result.meta.folderUid = dash.metadata.annotations?.[AnnoKeyFolder];
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

  async listDeletedDashboards(options: ListDeletedDashboardsOptions) {
    return await this.client.list({ ...options, labelSelector: 'grafana.app/get-trash=true' });
  }

  restoreDashboard(dashboard: Resource<DashboardDataDTO>) {
    // reset the resource version to create a new resource
    dashboard.metadata.resourceVersion = '';
    return this.client.create(dashboard);
  }
}
