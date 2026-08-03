import { lastValueFrom } from 'rxjs';

import { type LibraryPanelSpec, type LibraryPanelStatus } from '@grafana/api-clients/rtkq/dashboard/v0alpha1';
import { type FetchError, getBackendSrv } from '@grafana/runtime';
import { FlagKeys, getFeatureFlagClient } from '@grafana/runtime/internal';
import { type LibraryElementDTOMetaUser, type LibraryPanel } from '@grafana/schema';
import { getAPIBaseURL } from 'app/api/utils';
import { ScopedResourceClient } from 'app/features/apiserver/client';
import { discoveryResources, getAPIGroupDiscoveryList } from 'app/features/apiserver/discovery';
import {
  AnnoKeyCreatedBy,
  AnnoKeyFolder,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
  type ListOptions,
  type Resource,
  type ResourceForCreate,
  type ResourceList,
} from 'app/features/apiserver/types';

const DASHBOARD_API_GROUP = 'dashboard.grafana.app';
const DASHBOARD_API_VERSION = 'v0alpha1';
const LIBRARY_PANELS_RESOURCE = 'librarypanels';
const ROOT_FOLDER_NAME = 'General';
const REQUIRED_RESOURCE_VERBS = ['get', 'list', 'create', 'update', 'delete'];

export type LibraryPanelResource = Resource<LibraryPanelSpec, LibraryPanelStatus, 'LibraryPanel'>;

// ResourceForCreate has no status, but properties of the legacy panel model without
// a typed spec field travel in status.missing, so creates must carry it
type LibraryPanelResourceForCreate = ResourceForCreate<LibraryPanelSpec, 'LibraryPanel'> & {
  status?: LibraryPanelStatus;
};

function resourceClient(): ScopedResourceClient<LibraryPanelSpec, LibraryPanelStatus, 'LibraryPanel'> {
  return new ScopedResourceClient<LibraryPanelSpec, LibraryPanelStatus, 'LibraryPanel'>({
    group: DASHBOARD_API_GROUP,
    version: DASHBOARD_API_VERSION,
    resource: LIBRARY_PANELS_RESOURCE,
  });
}

function folderClient(): ScopedResourceClient<{ title: string }> {
  return new ScopedResourceClient<{ title: string }>({
    group: 'folder.grafana.app',
    version: 'v1beta1',
    resource: 'folders',
  });
}

// Resolved once per page load, mirroring isAnnotationApiAvailable: the set of
// registered API groups is static for the apiserver process lifetime. Failures are
// not cached so a transient outage can be retried by the next caller.
let apiAvailable: Promise<boolean> | undefined;

function isLibraryPanelApiAvailable(): Promise<boolean> {
  if (apiAvailable) {
    return apiAvailable;
  }

  const pending = getAPIGroupDiscoveryList().then((apis) =>
    discoveryResources(apis).some(
      (resource) =>
        resource.responseKind.group === DASHBOARD_API_GROUP &&
        resource.responseKind.version === DASHBOARD_API_VERSION &&
        resource.resource === LIBRARY_PANELS_RESOURCE &&
        REQUIRED_RESOURCE_VERBS.every((verb) => resource.verbs.includes(verb))
    )
  );

  const result = pending.catch(() => false);
  apiAvailable = result;

  pending.catch(() => {
    if (apiAvailable === result) {
      apiAvailable = undefined;
    }
  });

  return result;
}

/**
 * The k8s library panels client is gated by the FE feature flag
 * (`libraryelements.kubernetesLibraryPanels`) and discovery of the writable
 * `dashboard.grafana.app/v0alpha1/librarypanels` resource, so we never call an
 * endpoint an older backend does not serve.
 */
export function isK8sLibraryPanelsClientEnabled(): Promise<boolean> {
  if (!getFeatureFlagClient().getBooleanValue(FlagKeys.LibraryelementsKubernetesLibraryPanels, false)) {
    return Promise.resolve(false);
  }
  return isLibraryPanelApiAvailable();
}

// legacy model properties that map to typed fields on LibraryPanelSpec; everything
// else is preserved in status.missing (mirrors the backend conversion)
const specModelKeys = new Set([
  'type',
  'pluginVersion',
  'title',
  'description',
  'options',
  'fieldConfig',
  'datasource',
  'targets',
  'links',
  'transparent',
  'libraryPanel',
  'id',
  'gridPos',
]);

/**
 * Build the k8s spec and status of a library panel from the legacy panel model.
 * In the legacy model blob "title" is the panel display title (spec.panelTitle),
 * while the library panel name maps to spec.title.
 */
export function legacyModelToSpecAndStatus(
  name: string,
  legacyModel: object
): { spec: LibraryPanelSpec; status: LibraryPanelStatus } {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const model = legacyModel as Record<string, unknown>;
  const spec: LibraryPanelSpec = {
    type: typeof model.type === 'string' ? model.type : '',
    title: name,
    panelTitle: typeof model.title === 'string' ? model.title : '',
    options: model.options ?? {},
    fieldConfig: model.fieldConfig ?? {},
  };
  if (typeof model.pluginVersion === 'string' && model.pluginVersion !== '') {
    spec.pluginVersion = model.pluginVersion;
  }
  if (typeof model.description === 'string' && model.description !== '') {
    spec.description = model.description;
  }
  if (model.datasource !== undefined && model.datasource !== null) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    spec.datasource = model.datasource as LibraryPanelSpec['datasource'];
  }
  if (Array.isArray(model.targets) && model.targets.length > 0) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    spec.targets = model.targets as LibraryPanelSpec['targets'];
  }
  if (Array.isArray(model.links) && model.links.length > 0) {
    spec.links = model.links;
  }
  if (model.transparent === true) {
    spec.transparent = true;
  }
  if (model.gridPos !== undefined && model.gridPos !== null) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    spec.gridPos = model.gridPos as LibraryPanelSpec['gridPos'];
  }

  const missing: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(model)) {
    if (!specModelKeys.has(key)) {
      missing[key] = value;
    }
  }

  return { spec, status: { missing } };
}

/**
 * Rebuild the legacy panel model from the k8s spec and status. The model
 * intentionally omits gridPos/id/libraryPanel, which LibraryPanel.model excludes.
 */
export function k8sResourceToLegacyModel(item: LibraryPanelResource): LibraryPanel['model'] {
  const spec = item.spec;
  const model: Record<string, unknown> = { ...(item.status?.missing ?? {}) };
  model.type = spec.type;
  model.title = spec.panelTitle ?? '';
  if (spec.pluginVersion) {
    model.pluginVersion = spec.pluginVersion;
  }
  if (spec.description) {
    model.description = spec.description;
  }
  model.options = spec.options ?? {};
  model.fieldConfig = spec.fieldConfig ?? {};
  if (spec.datasource) {
    model.datasource = spec.datasource;
  }
  if (spec.targets && spec.targets.length > 0) {
    model.targets = spec.targets;
  }
  if (spec.links && spec.links.length > 0) {
    model.links = spec.links;
  }
  if (spec.transparent) {
    model.transparent = spec.transparent;
  }
  delete model.gridPos;
  delete model.id;
  delete model.libraryPanel;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return model as LibraryPanel['model'];
}

const emptyUser: LibraryElementDTOMetaUser = { avatarUrl: '', id: 0, name: '' };

export function k8sResourceToLegacyDTO(
  item: LibraryPanelResource,
  enrichment?: {
    folderName?: string;
    connectedDashboards?: number;
    createdBy?: LibraryElementDTOMetaUser;
    updatedBy?: LibraryElementDTOMetaUser;
  }
): LibraryPanel {
  const metadata = item.metadata;
  const annotations = metadata.annotations ?? {};
  const folderUid = annotations[AnnoKeyFolder] ?? '';
  const created = metadata.creationTimestamp ?? '';
  const updated = annotations[AnnoKeyUpdatedTimestamp] ?? created;

  return {
    uid: metadata.name,
    folderUid,
    name: item.spec.title ?? '',
    type: item.spec.type,
    description: item.spec.description ?? '',
    model: k8sResourceToLegacyModel(item),
    version: metadata.generation ?? 1,
    meta: {
      folderName: enrichment?.folderName ?? (folderUid ? '' : ROOT_FOLDER_NAME),
      folderUid,
      connectedDashboards: enrichment?.connectedDashboards ?? 0,
      created,
      updated,
      createdBy: enrichment?.createdBy ?? emptyUser,
      updatedBy: enrichment?.updatedBy ?? enrichment?.createdBy ?? emptyUser,
    },
  };
}

/** Resolve folder titles for the given folder UIDs; unresolvable folders map to ''. */
async function resolveFolderNames(folderUIDs: string[], signal?: AbortSignal): Promise<Map<string, string>> {
  const titles = new Map<string, string>([['', ROOT_FOLDER_NAME]]);
  const client = folderClient();
  await Promise.all(
    [...new Set(folderUIDs)].map(async (uid) => {
      if (!uid) {
        return;
      }
      try {
        const folder = signal
          ? (
              await lastValueFrom(
                getBackendSrv().fetch<Resource<{ title: string }>>({
                  method: 'GET',
                  url: `${client.url}/${uid}`,
                  abortSignal: signal,
                  showErrorAlert: false,
                })
              )
            ).data
          : await client.get(uid);
        titles.set(uid, folder.spec.title);
      } catch (error) {
        if (signal?.aborted) {
          throw error;
        }
        titles.set(uid, '');
      }
    })
  );
  return titles;
}

interface DisplayList {
  display: Array<{
    avatarURL?: string;
    displayName: string;
    identity: { type: string; name?: string };
    internalId?: number;
  }>;
}

/** Resolve identity keys (e.g. "user:abc") to display users via the iam display API. */
async function resolveUserDisplays(keys: string[]): Promise<Map<string, LibraryElementDTOMetaUser>> {
  const users = new Map<string, LibraryElementDTOMetaUser>();
  const wanted = [...new Set(keys.filter((k) => !!k))];
  if (wanted.length === 0) {
    return users;
  }
  try {
    const url = `${getAPIBaseURL('iam.grafana.app', 'v0alpha1')}/display`;
    const result = await getBackendSrv().get<DisplayList>(url, { key: wanted });
    for (const display of result.display ?? []) {
      const key = `${display.identity.type}:${display.identity.name ?? ''}`;
      users.set(key, {
        avatarUrl: display.avatarURL ?? '',
        id: display.internalId ?? 0,
        name: display.displayName,
      });
    }
  } catch {
    // display resolution is best effort; the DTO falls back to empty users
  }
  return users;
}

async function fetchConnectedDashboardsCount(uid: string): Promise<number> {
  try {
    const { result } = await getBackendSrv().get<{ result: unknown[] }>(`/api/library-elements/${uid}/connections`);
    return result.length;
  } catch {
    return 0;
  }
}

async function listAll(signal?: AbortSignal): Promise<LibraryPanelResource[]> {
  const client = resourceClient();
  const items: LibraryPanelResource[] = [];
  const opts: ListOptions = { limit: 500 };
  for (;;) {
    const page = (
      await lastValueFrom(
        getBackendSrv().fetch<ResourceList<LibraryPanelSpec, LibraryPanelStatus, 'LibraryPanel'>>({
          method: 'GET',
          url: client.url,
          params: opts,
          abortSignal: signal,
          showErrorAlert: false,
        })
      )
    ).data;
    items.push(...page.items);
    if (!page.metadata.continue) {
      return items;
    }
    opts.continue = page.metadata.continue;
  }
}

export interface K8sGetLibraryPanelsOptions {
  searchString?: string;
  perPage?: number;
  page?: number;
  excludeUid?: string;
  sortDirection?: string;
  typeFilter?: string[];
  folderFilterUIDs?: string[];
  signal?: AbortSignal;
}

export interface K8sLibraryPanelsSearchResult {
  totalCount: number;
  elements: LibraryPanel[];
  perPage: number;
  page: number;
}

export const libraryPanelsK8sClient = {
  async list({
    searchString = '',
    perPage = 100,
    page = 1,
    excludeUid = '',
    sortDirection = '',
    typeFilter = [],
    folderFilterUIDs = [],
    signal,
  }: K8sGetLibraryPanelsOptions = {}): Promise<K8sLibraryPanelsSearchResult> {
    const items = await listAll(signal);
    const search = searchString.trim().toLowerCase();
    const currentPage = Math.max(page, 1);

    // the legacy search also matches panels whose folder title contains the search
    // string (unless an explicit folder filter is set), so resolve folder titles
    // for all items up front; otherwise only the returned page needs them
    const matchByFolderTitle = search !== '' && folderFilterUIDs.length === 0;
    let folderNames = new Map<string, string>();
    if (matchByFolderTitle) {
      folderNames = await resolveFolderNames(
        items.map((item) => item.metadata.annotations?.[AnnoKeyFolder] ?? ''),
        signal
      );
    }

    const filtered = items.filter((item) => {
      const folderUid = item.metadata.annotations?.[AnnoKeyFolder] ?? '';
      if (excludeUid && item.metadata.name === excludeUid) {
        return false;
      }
      if (typeFilter.length > 0 && !typeFilter.includes(item.spec.type)) {
        return false;
      }
      if (folderFilterUIDs.length > 0) {
        // the legacy filter uses the "general" sentinel for root-level panels
        const wanted = folderUid === '' ? 'general' : folderUid;
        if (!folderFilterUIDs.includes(wanted)) {
          return false;
        }
      }
      if (search) {
        const name = (item.spec.title ?? '').toLowerCase();
        const description = (item.spec.description ?? '').toLowerCase();
        const folderTitle = (folderNames.get(folderUid) ?? '').toLowerCase();
        if (
          !name.includes(search) &&
          !description.includes(search) &&
          !(matchByFolderTitle && folderUid !== '' && folderTitle !== '' && folderTitle.includes(search))
        ) {
          return false;
        }
      }
      return true;
    });

    const sortAsc = sortDirection !== 'alpha-desc';
    const collator = new Intl.Collator();
    filtered.sort((a, b) => {
      const compared = collator.compare(a.spec.title ?? '', b.spec.title ?? '');
      return sortAsc ? compared : -compared;
    });

    const start = Math.min(perPage * (currentPage - 1), filtered.length);
    const pageItems = filtered.slice(start, start + perPage);
    if (!matchByFolderTitle) {
      folderNames = await resolveFolderNames(
        pageItems.map((item) => item.metadata.annotations?.[AnnoKeyFolder] ?? ''),
        signal
      );
    }

    return {
      totalCount: filtered.length,
      // meta.connectedDashboards stays 0 in list responses: no list consumer renders
      // it and resolving it costs one search query per panel; the single get fills it in
      elements: pageItems.map((item) =>
        k8sResourceToLegacyDTO(item, {
          folderName: folderNames.get(item.metadata.annotations?.[AnnoKeyFolder] ?? ''),
        })
      ),
      perPage,
      page: currentPage,
    };
  },

  async get(uid: string, isHandled = false): Promise<LibraryPanel> {
    const client = resourceClient();
    const item = (
      await lastValueFrom(
        getBackendSrv().fetch<LibraryPanelResource>({
          method: 'GET',
          url: `${client.url}/${uid}`,
          showSuccessAlert: !isHandled,
          showErrorAlert: !isHandled,
        })
      )
    ).data;
    const annotations = item.metadata.annotations ?? {};
    const createdByKey = annotations[AnnoKeyCreatedBy] ?? '';
    const updatedByKey = annotations[AnnoKeyUpdatedBy] ?? createdByKey;

    const [folderNames, users, connectedDashboards] = await Promise.all([
      resolveFolderNames([annotations[AnnoKeyFolder] ?? '']),
      resolveUserDisplays([createdByKey, updatedByKey]),
      fetchConnectedDashboardsCount(uid),
    ]);

    return k8sResourceToLegacyDTO(item, {
      folderName: folderNames.get(annotations[AnnoKeyFolder] ?? ''),
      connectedDashboards,
      createdBy: users.get(createdByKey),
      updatedBy: users.get(updatedByKey),
    });
  },

  async getByName(name: string): Promise<LibraryPanel[]> {
    const items = await listAll();
    return items.filter((item) => item.spec.title === name).map((item) => k8sResourceToLegacyDTO(item));
  },

  async create(name: string, model: object, folderUid: string, uid?: string): Promise<LibraryPanel> {
    const { spec, status } = legacyModelToSpecAndStatus(name, model);
    const obj: LibraryPanelResourceForCreate = {
      // the server generates the uid when one is not provided
      metadata: uid ? { name: uid } : { generateName: 'p' },
      spec,
      status,
    };
    if (folderUid) {
      obj.metadata.annotations = { [AnnoKeyFolder]: folderUid };
    }
    const created = await resourceClient().create(obj);
    return this.get(created.metadata.name);
  },

  async update(uid: string, name: string, model: object, version: number, folderUid?: string): Promise<LibraryPanel> {
    const client = resourceClient();
    const existing = await client.get(uid);
    const currentVersion = existing.metadata.generation ?? 1;
    if (currentVersion !== version) {
      const message = 'the library element has been changed by someone else';
      const error: FetchError<{ message: string }> = {
        status: 412,
        statusText: 'Precondition Failed',
        data: { message },
        message,
        config: { url: `${client.url}/${uid}`, method: 'PUT' },
      };
      throw error;
    }
    // legacy PATCH semantics: an absent folderUid keeps the panel in its current folder
    if (folderUid === undefined) {
      folderUid = existing.metadata.annotations?.[AnnoKeyFolder] ?? '';
    }
    const annotations = { ...existing.metadata.annotations };
    if (folderUid) {
      annotations[AnnoKeyFolder] = folderUid;
    } else {
      delete annotations[AnnoKeyFolder];
    }
    const { spec, status } = legacyModelToSpecAndStatus(name, model);
    const obj: LibraryPanelResource = {
      apiVersion: `${DASHBOARD_API_GROUP}/${DASHBOARD_API_VERSION}`,
      kind: 'LibraryPanel',
      metadata: {
        ...existing.metadata,
        name: uid,
        // generation carries the legacy optimistic-concurrency version check
        generation: version,
        resourceVersion: existing.metadata.resourceVersion ?? '',
        creationTimestamp: existing.metadata.creationTimestamp ?? '',
        annotations,
      },
      spec,
      status,
    };
    const updated = await client.update(obj);
    return this.get(updated.metadata.name);
  },

  async remove(uid: string): Promise<{ message: string }> {
    await resourceClient().delete(uid, false);
    return { message: 'Library element deleted' };
  },
};
