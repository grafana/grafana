import { locationUtil, type UrlQueryMap } from '@grafana/data';
import { t } from '@grafana/i18n';
import { type DashboardLink } from '@grafana/schema';
import { type Status } from '@grafana/schema/apis/dashboard.grafana.app/v2';
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
import { getDashboardUrl } from 'app/features/dashboard-scene/utils/getDashboardUrl';
import { type DeleteDashboardResponse } from 'app/features/manage-dashboards/types';
import { type DashboardDTO, type SaveDashboardResponseDTO } from 'app/types/dashboard';

import { type SaveDashboardCommand } from '../components/SaveDashboard/types';
import { VERSIONS_FETCH_LIMIT } from '../types/revisionModels';

import {
  type DashboardAPI,
  DashboardVersionError,
  type DashboardWithAccessInfo,
  type ListDashboardHistoryOptions,
  type ListDeletedDashboardsOptions,
} from './types';
import { buildRestorePayload, isV0V1StoredVersion } from './utils';

/**
 * Minimal shape a dashboard schema spec must satisfy for the shared client.
 * v2 and v3alpha0 both expose `links` — the client injects repo-source links there.
 */
export interface DashboardSchemaSpec {
  links?: DashboardLink[];
}

interface K8sDashboardSchemaAPIConfig {
  /** API group, typically 'dashboard.grafana.app' */
  group: string;
  /** API version string, e.g. 'v2', 'v2beta1', 'v3alpha0' */
  version: string;
  /** Resource kind, typically 'dashboards' */
  resource: string;
}

/**
 * Generic k8s-style DashboardAPI implementation parameterised by spec type.
 *
 * Wire semantics are identical across v2 and v3alpha0 — they share the k8s REST
 * surface on /apis/dashboard.grafana.app/<version>/namespaces/<ns>/dashboards.
 * Only the spec payload differs. Concrete versions instantiate this with their
 * spec type and a config pointing at their API version.
 *
 * Subclasses may override `convertSpecToWireFormat` when the save path needs
 * schema-specific wire normalisation (e.g. v2's transformation kind compat).
 */
export class K8sDashboardSchemaAPI<TSpec extends DashboardSchemaSpec>
  implements DashboardAPI<DashboardWithAccessInfo<TSpec> | DashboardDTO, TSpec>
{
  protected client: ResourceClient<TSpec, Status>;

  constructor(config: K8sDashboardSchemaAPIConfig) {
    this.client = new ScopedResourceClient<TSpec>(config);
  }

  /**
   * Override in subclasses that need to transform the spec before sending.
   * Default is identity. v2 overrides this to normalise transformation kinds.
   */
  protected convertSpecToWireFormat(spec: TSpec): TSpec {
    return spec;
  }

  async getDashboardDTO(uid: string, params?: UrlQueryMap) {
    try {
      const dashboard = await this.client.subresource<DashboardWithAccessInfo<TSpec>>(uid, 'dto', params);
      // FOR /dto calls we ignore the conversion status to avoid runtime errors from
      // status saved for resources that went through client-side conversion.
      if (dashboard.status?.conversion?.failed && isV0V1StoredVersion(dashboard.status.conversion.storedVersion)) {
        throw new DashboardVersionError(dashboard.status.conversion.storedVersion, dashboard.status.conversion.error);
      }

      if (dashboard.metadata.annotations && dashboard.metadata.annotations[AnnoKeyFolder]) {
        try {
          // Dynamic import here avoids a module-evaluation cycle between
          // folder/hooks -> browseDashboardsAPI -> dashboard_api -> v2/v3alpha0 clients.
          // Top-level static import leaves K8sDashboardSchemaAPI undefined when
          // v3alpha0.ts resolves its `extends` clause during the cycle.
          const { getFolderByUidFacade } = await import('app/api/clients/folder/v1beta1/hooks');
          const folder = await getFolderByUidFacade(dashboard.metadata.annotations[AnnoKeyFolder]);
          dashboard.metadata.annotations[AnnoKeyFolderTitle] = folder.title;
          dashboard.metadata.annotations[AnnoKeyFolderUrl] = folder.url;
        } catch (e) {
          if (getStatusFromError(e) !== 403) {
            throw new Error('Failed to load folder');
          }
        }
      } else if (dashboard.metadata.annotations && !dashboard.metadata.annotations[AnnoKeyFolder]) {
        // Top-level dashboards get an empty folder annotation so NestedFolderPicker
        // treats them as living in the Dashboard root.
        dashboard.metadata.annotations[AnnoKeyFolder] = '';
      }

      // Dynamic import for the same module-cycle reason as getFolderByUidFacade above.
      const { buildSourceLink, removeExistingSourceLinks } = await import(
        'app/features/provisioning/utils/sourceLink'
      );
      const sourceLink = await buildSourceLink(dashboard.metadata.annotations);
      if (sourceLink) {
        const linksWithoutSource = removeExistingSourceLinks(dashboard.spec.links);
        dashboard.spec.links = [sourceLink, ...linksWithoutSource];
      }

      return dashboard;
    } catch (e) {
      const status = getStatusFromError(e);
      const message = getMessageFromError(e);
      // Work around k8s apiserver returning 500 for not-found resources.
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

  async saveDashboard(options: SaveDashboardCommand<TSpec>): Promise<SaveDashboardResponseDTO> {
    const dashboard = this.convertSpecToWireFormat(options.dashboard);

    const obj: ResourceForCreate<TSpec> = {
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

    if (options.folderUid !== undefined) {
      delete obj.metadata.annotations?.[AnnoKeyFolderTitle];
      delete obj.metadata.annotations?.[AnnoKeyFolderUrl];

      obj.metadata.annotations = {
        ...obj.metadata.annotations,
        [AnnoKeyFolder]: options.folderUid,
      };
    }

    if (obj.metadata.name) {
      delete obj.metadata.resourceVersion;
      delete obj.metadata.labels?.[DeprecatedInternalId];
      return this.client.update(obj).then((v) => this.asSaveDashboardResponseDTO(v));
    }
    obj.metadata.annotations = {
      ...obj.metadata.annotations,
      [AnnoKeyGrantPermissions]: 'default',
    };
    // Clear the deprecated id label so the backend generates a fresh unique id.
    delete obj.metadata.labels?.[DeprecatedInternalId];
    return await this.client.create(obj).then((v) => this.asSaveDashboardResponseDTO(v));
  }

  protected asSaveDashboardResponseDTO(v: Resource<TSpec>): SaveDashboardResponseDTO {
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

  async listDashboardHistory(uid: string, options?: ListDashboardHistoryOptions): Promise<ResourceList<TSpec>> {
    const limit = options?.limit ?? VERSIONS_FETCH_LIMIT;
    let continueToken = options?.continueToken;
    const items: Array<Resource<TSpec>> = [];

    let lastPage: ResourceList<TSpec> | undefined;

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
    const results: Array<Resource<TSpec>> = [];
    const versionsToFind = new Set(versions);
    let continueToken: string | undefined;

    do {
      // Large limit so a single page normally carries all requested versions;
      // pagination is the fallback for dashboards with very long histories.
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

  restoreDashboard(dashboard: Resource<TSpec>) {
    return this.client.create(buildRestorePayload(dashboard));
  }
}
