import { locationUtil, type UrlQueryMap } from '@grafana/data/utils';
import { t } from '@grafana/i18n';
import { type Status, type Spec as DashboardV2Spec } from '@grafana/schema/apis/dashboard.grafana.app/v2';
import { getFolderByUidFacade } from 'app/api/clients/folder/v1beta1/hooks';
import { getMessageFromError, getStatusFromError } from 'app/core/utils/errors';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import {
  AnnoKeyFolder,
  AnnoKeyFolderTitle,
  AnnoKeyFolderUrl,
  AnnoKeyGrantPermissions,
  AnnoKeyMessage,
  DeprecatedInternalId,
  type Resource,
  type ResourceClient,
  type ResourceForCreate,
  type ResourceList,
} from 'app/features/apiserver/types';
import { convertSpecToWireFormat } from 'app/features/dashboard-scene/serialization/transformationCompat';
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';
import { type DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { buildSourceLink, removeExistingSourceLinks } from 'app/features/provisioning/utils/sourceLink';
import { type DashboardDTO, type SaveDashboardResponseDTO } from 'app/types/dashboard';

import { type SaveDashboardCommand } from '../components/SaveDashboard/types';
import { VERSIONS_FETCH_LIMIT } from '../types/revisionModels';

import { dashboardAPIVersionResolver } from './DashboardAPIVersionResolver';
import {
  type DashboardAPI,
  DashboardVersionError,
  type DashboardWithAccessInfo,
  type ListDashboardHistoryOptions,
  type ListDeletedDashboardsOptions,
} from './types';
import { buildRestorePayload, isV0V1StoredVersion } from './utils';

export function getK8sV2DashboardApiConfig() {
  return {
    group: 'dashboard.grafana.app',
    version: dashboardAPIVersionResolver.getV2(),
    resource: 'dashboards',
  };
}

export class K8sDashboardV2API
  implements DashboardAPI<DashboardWithAccessInfo<DashboardV2Spec> | DashboardDTO, DashboardV2Spec>
{
  private client: ResourceClient<DashboardV2Spec, Status>;

  constructor() {
    this.client = new ScopedResourceClient<DashboardV2Spec>(getK8sV2DashboardApiConfig());
  }

  async getDashboardDTO(uid: string, params?: UrlQueryMap) {
    try {
      const dashboard = await this.client.subresource<DashboardWithAccessInfo<DashboardV2Spec>>(uid, 'dto', params);
      // FOR /dto calls returning v2 spec we are ignoring the conversion status to avoid runtime errors caused by the status
      // being saved for v2 resources that's been client-side converted to v2 and then PUT to the API server.
      // This could come as conversion error from v0 or v2 to V1.
      if (dashboard.status?.conversion?.failed && isV0V1StoredVersion(dashboard.status.conversion.storedVersion)) {
        throw new DashboardVersionError(dashboard.status.conversion.storedVersion, dashboard.status.conversion.error);
      }

      // load folder info if available
      if (dashboard.metadata.annotations && dashboard.metadata.annotations[AnnoKeyFolder]) {
        try {
          const folder = await getFolderByUidFacade(dashboard.metadata.annotations[AnnoKeyFolder]);
          dashboard.metadata.annotations[AnnoKeyFolderTitle] = folder.title;
          dashboard.metadata.annotations[AnnoKeyFolderUrl] = folder.url;
        } catch (e) {
          // If user has access to dashboard but not to folder, continue without folder info
          if (getStatusFromError(e) !== 403) {
            throw new Error('Failed to load folder');
          }
        }
      } else if (dashboard.metadata.annotations && !dashboard.metadata.annotations[AnnoKeyFolder]) {
        // Set AnnoKeyFolder to empty string for top-level dashboards
        // This ensures NestedFolderPicker correctly identifies it as being in the "Dashboard" root folder
        // AnnoKeyFolder undefined -> top-level dashboard -> empty string
        dashboard.metadata.annotations[AnnoKeyFolder] = '';
      }

      // Inject source link for repo-managed dashboards
      const sourceLink = await buildSourceLink(dashboard.metadata.annotations);
      if (sourceLink) {
        const linksWithoutSource = removeExistingSourceLinks(dashboard.spec.links);
        dashboard.spec.links = [sourceLink, ...linksWithoutSource];
      }

      return dashboard;
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
      title: t('dashboard.k8s-dashboard-v2api.title.deleted', 'deleted'),
    }));
  }

  async saveDashboard(options: SaveDashboardCommand<DashboardV2Spec>): Promise<SaveDashboardResponseDTO> {
    const dashboard = convertSpecToWireFormat(options.dashboard);

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
    if (options.folderUid !== undefined) {
      // remove frontend folder annotations
      delete obj.metadata.annotations?.[AnnoKeyFolderTitle];
      delete obj.metadata.annotations?.[AnnoKeyFolderUrl];

      obj.metadata.annotations = {
        ...obj.metadata.annotations,
        [AnnoKeyFolder]: options.folderUid,
      };
    }

    if (obj.metadata.name) {
      // remove resource version when updating
      delete obj.metadata.resourceVersion;
      delete obj.metadata.labels?.[DeprecatedInternalId];
      return this.client.update(obj).then((v) => this.asSaveDashboardResponseDTO(v));
    }
    obj.metadata.annotations = {
      ...obj.metadata.annotations,
      [AnnoKeyGrantPermissions]: 'default',
    };
    // clear the deprecated id label so the backend generates a new unique id to prevent duplicate ids.
    delete obj.metadata.labels?.[DeprecatedInternalId];
    return await this.client.create(obj).then((v) => this.asSaveDashboardResponseDTO(v));
  }

  asSaveDashboardResponseDTO(v: Resource<DashboardV2Spec>): SaveDashboardResponseDTO {
    //TODO: use slug from response once implemented
    const slug = '';

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
      status: 'success',
      url,
      slug,
    };
  }

  async listDashboardHistory(
    uid: string,
    options?: ListDashboardHistoryOptions
  ): Promise<ResourceList<DashboardV2Spec>> {
    const limit = options?.limit ?? VERSIONS_FETCH_LIMIT;
    let continueToken = options?.continueToken;
    const items: Array<Resource<DashboardV2Spec>> = [];

    let lastPage: ResourceList<DashboardV2Spec> | undefined;

    do {
      lastPage = await this.client.list({
        labelSelector: 'grafana.app/get-history=true',
        fieldSelector: `metadata.name=${uid}`,
        limit: limit - items.length,
        continue: continueToken,
      });
      items.push(...lastPage.items);
      continueToken = lastPage.metadata.continue;
    } while (items.length < limit && continueToken);

    return { ...lastPage!, metadata: { ...lastPage!.metadata, continue: continueToken }, items };
  }

  async getDashboardHistoryVersions(uid: string, versions: number[]) {
    const results: Array<Resource<DashboardV2Spec>> = [];
    const versionsToFind = new Set(versions);
    let continueToken: string | undefined;

    do {
      // using high limit to attempt finding the versions in one request
      // if not found, pagination will kick in
      const history = await this.listDashboardHistory(uid, { limit: 1000, continueToken });
      for (const item of history.items) {
        if (versionsToFind.has(item.metadata.generation ?? 0)) {
          results.push(item);
          versionsToFind.delete(item.metadata.generation ?? 0);
        }
      }
      continueToken = versionsToFind.size > 0 ? history.metadata.continue : undefined;
    } while (continueToken);

    if (versionsToFind.size > 0) {
      throw new Error(`Dashboard version not found: ${[...versionsToFind].join(', ')}`);
    }
    return results;
  }

  async restoreDashboardVersion(uid: string, version: number): Promise<SaveDashboardResponseDTO> {
    // get version to restore to, and save as new one
    // fetch current dashboard in parallel to preserve its folder location
    const [historicalVersion, currentDashboard] = await Promise.all([
      this.getDashboardHistoryVersions(uid, [version]).then((v) => v[0]),
      this.client.get(uid),
    ]);
    return await this.saveDashboard({
      dashboard: historicalVersion.spec,
      k8s: {
        name: uid,
      },
      message: `Restored from version ${version}`,
      folderUid: currentDashboard.metadata?.annotations?.[AnnoKeyFolder],
    });
  }

  listDeletedDashboards(options: ListDeletedDashboardsOptions) {
    return this.client.list({ ...options, labelSelector: 'grafana.app/get-trash=true' });
  }

  restoreDashboard(dashboard: Resource<DashboardV2Spec>) {
    return this.client.create(buildRestorePayload(dashboard));
  }
}
