import { type UnknownAction } from '@reduxjs/toolkit';

import { getBackendSrv } from '@grafana/runtime';
import { type KindInfo } from '@grafana/runtime/unstable';
import { playlistAPIv1 } from 'app/api/clients/playlist/v1';
import { type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';
import { getAPIBaseURL } from 'app/api/utils';
import { CORE_KINDS, coversGroup } from 'app/core/kinds/coreKinds';
import { getAPIGroupDiscoveryList } from 'app/features/apiserver/discovery';
import { AnnoKeyFolder } from 'app/features/apiserver/types';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';
import { queryResultToViewItem } from 'app/features/search/service/utils';
import { type AppDispatch } from 'app/store/configureStore';

import { isManaged } from './managedResource';

/**
 * A resource of some kind enumerated from the instance, in the minimal shape the
 * provisioning UI needs to list and migrate it. Where it lands in the migrate
 * table is decided from its kind: folder-scoped kinds nest under `parentUid`,
 * others group under a synthetic per-kind row.
 */
export interface ListedResource {
  uid: string;
  title: string;
  /** Immediate parent folder UID; undefined for root or non-folder-scoped kinds. */
  parentUid?: string;
  /** Owned by a manager (Git Sync, Terraform, …), or otherwise not writable — no migration target. */
  managed: boolean;
  /**
   * The API group serving this resource, for a kind whose registry group is a collection and so
   * cannot supply it. A job addresses a resource through the group that serves it.
   */
  group?: string;
}

/** Dependencies a kind's `list()` may need. `dispatch` lets a kind read through
 * an RTK Query client imperatively. */
interface ResourceListDeps {
  dispatch: AppDispatch;
  /**
   * The backend's declared resources, so a collection kind enumerates only the members provisioning
   * acts on. Undefined before settings load, which enumerates every member served.
   */
  availableResources?: SupportedResource[];
}

/**
 * Ties each registry entry to the {@link CORE_KINDS} row of the same key, so an entry cannot spread
 * another kind's row. `Record<string, unknown>` admits the fields only provisioning adds.
 */
type OnCoreKinds = {
  [K in keyof typeof CORE_KINDS]?: (typeof CORE_KINDS)[K] & Record<string, unknown>;
};

/**
 * Registry of provisioning resource kinds, keyed by a stable identifier — the single source of truth
 * the UI reads from instead of scattering per-kind knowledge across switch statements (tree labels,
 * count labels, resource-ref unions, how to enumerate each kind). Each entry builds on the kind's
 * shared description in {@link CORE_KINDS} (identity, icon, label, pages) and adds what only
 * provisioning needs.
 *
 * `as const` preserves the literal field types so the keys ({@link ResourceKindKey}) and tree labels
 * ({@link ResourceKindName}) are derived from this object: adding a kind is ONE entry here and one in
 * {@link CORE_KINDS} (plus, if needed, enabling it on the backend so it appears in the settings
 * endpoint's `availableResources`) — no parallel unions to keep in sync. Entries are validated
 * against {@link ResourceKindInfo} where `allKindInfos` is built below; `as const` is used instead of
 * `satisfies ResourceKindInfo` because the interface references the derived types, which `satisfies`
 * would make a circular reference.
 */
export const resourceKindInfos = {
  folder: {
    ...CORE_KINDS.folder,
    list: () => listViaSearch(CORE_KINDS.folder.searchKind),
    alwaysAvailable: true,
  },
  dashboard: {
    ...CORE_KINDS.dashboard,
    list: () => listViaSearch(CORE_KINDS.dashboard.searchKind),
    alwaysAvailable: true,
  },
  playlist: {
    ...CORE_KINDS.playlist,
    // Playlists aren't in the unified search index; list them through their
    // generated apiserver client (which carries the v1→v0alpha1 fallback).
    list: ({ dispatch }: ResourceListDeps) => listPlaylists(dispatch),
    // Gated on availableResources — not part of the static folder+dashboard base.
    alwaysAvailable: false,
    // The playlist list is fetched elsewhere; invalidate it so a committed change shows up there.
    invalidateListTags: () => playlistAPIv1.util.invalidateTags(['Playlist']),
  },
  librarypanel: {
    ...CORE_KINDS.librarypanel,
    // Library panels aren't in the unified search index; list them through their
    // apiserver (same group as dashboards, v0alpha1). Gated out of migration by
    // default — they ship disabled and aren't in the static base — so this only
    // runs once the backend reports the kind as available.
    list: () => listViaApiserver(CORE_KINDS.librarypanel.group, 'v0alpha1', CORE_KINDS.librarypanel.resource),
    alwaysAvailable: false,
  },
  repository: {
    ...CORE_KINDS.repository,
    // Provisioning's own configuration is never a migration target: it is the mechanism that
    // moves resources into a repository, so it is not one of the resources moved.
    list: async () => [],
    alwaysAvailable: false,
  },
  connection: {
    ...CORE_KINDS.connection,
    // Not a migration target, for the same reason as repositories.
    list: async () => [],
    alwaysAvailable: false,
  },
  datasource: {
    ...CORE_KINDS.datasource,
    list: ({ availableResources }: ResourceListDeps) => {
      const { group, resource, kind } = CORE_KINDS.datasource;
      return listCollectionMembers(group, resource, kind, availableResources);
    },
    alwaysAvailable: false,
  },
} as const satisfies OnCoreKinds;

/**
 * Stable per-kind key (`folder`, `dashboard`, `playlist`, ...) used to identify a provisioning
 * resource kind across the UI: the commit-message noun, branch-name prefix, telemetry and the shared
 * edit-form fields all use this. Derived from the registry keys, so a new kind only needs its
 * registry entry.
 */
export type ResourceKindKey = keyof typeof resourceKindInfos;

/**
 * Tree-view labels for the provisioning *resource* kinds (`Folder`, `Dashboard`, ...), derived from
 * the registry's `kind`s so the set stays in lockstep with the kinds above. The full tree
 * {@link TreeItemKind} (these labels plus the `File` fallback) is assembled from this in `../types`, so a
 * new kind needs no edit there either.
 */
export type ResourceKindName = (typeof resourceKindInfos)[ResourceKindKey]['kind'];

/**
 * Consumer-facing shape of a registry entry: the kind's shared description plus what provisioning
 * needs to know about it. `kind` is typed as the derived union, so a {@link ResourceKindInfo}
 * carries the kind's tree label without a separate lookup.
 *
 * This is the single source of truth the UI reads from instead of scattering per-kind knowledge
 * across switch statements (tree labels, count labels, resource-ref unions, how to enumerate each
 * kind). Adding a new provisioning kind is one {@link resourceKindInfos} entry on top of its
 * {@link CORE_KINDS} one, plus (if needed) enabling it on the backend so it appears in the settings
 * `availableResources`.
 */
export interface ResourceKindInfo extends KindInfo {
  /** Kubernetes Kind, e.g. `Dashboard`. Also the label shown for this kind in the files/resources tree. */
  kind: ResourceKindName;
  /**
   * Enumerates every resource of this kind on the instance. Each kind owns how it
   * lists itself — dashboards/folders through the unified search index, playlists
   * through their generated apiserver client — so callers iterate kinds
   * generically without knowing the data source. `dispatch` is provided for kinds
   * that read through an RTK Query client; kinds that don't simply ignore it.
   */
  list: (deps: ResourceListDeps) => Promise<ListedResource[]>;
  /**
   * Whether the kind is in the static provisioning base (folder + dashboard),
   * which the backend always supports. Such kinds are acted on regardless of the
   * settings endpoint's `availableResources`; others are gated on it.
   */
  alwaysAvailable: boolean;
  /**
   * Builds the action that invalidates this kind's list-view cache, dispatched after a successful
   * commit so the change shows up when navigating back to the list. Optional — only kinds whose
   * pages drive `SaveProvisionedResourceDrawer` need it. Defining it couples this registry to the
   * kind's RTK Query client (the cost of keeping per-kind invalidation here rather than in a hook).
   */
  invalidateListTags?: () => UnknownAction;
}

// Widening the `as const` registry to ResourceKindInfo[] here also validates every entry against the
// interface — a missing or mis-typed field (e.g. an unknown `icon`) fails at this line rather than at
// each call site. The registry keys and literal `kind` values stay the source of truth for the unions above.
const allKindInfos: ResourceKindInfo[] = Object.values(resourceKindInfos);

/**
 * The group a kind is named by: the collection rather than the member group that served a given
 * resource, so every member of a collection is reported as one kind.
 */
export function getReportedGroup(group?: string, kind?: string): string | undefined {
  const info = getKindInfoByGroupKind(group, kind);
  return info?.collectionGroup ? info.group : group;
}

/** Look up a kind by its plural resource name (`ResourceListItem.resource`). */
export function getKindInfoByResource(resource?: string): ResourceKindInfo | undefined {
  return allKindInfos.find((info) => info.resource === resource);
}

/**
 * Look up a kind by its Kubernetes Kind, which is also its tree label. Accepts any string (tree
 * items can be the `File` fallback, which has no backing kind and resolves to `undefined`) so
 * callers don't depend on the `TreeItemKind` union and create an import cycle with `../types`.
 */
export function getKindInfoByKind(kind: string): ResourceKindInfo | undefined {
  return allKindInfos.find((info) => info.kind === kind);
}

/**
 * Look up a kind by a resource-stat group, accepting both the full API group
 * (`folder.grafana.app`) and the legacy short plural (`folders`) that the stats
 * endpoint can return interchangeably.
 *
 * Prefer `getKindInfoByStat` when a `resource` is available: several kinds can
 * share an API group, so the group alone does not always identify the kind.
 */
export function getKindInfoByStatGroup(group?: string): ResourceKindInfo | undefined {
  return allKindInfos.find((info) => (group !== undefined && coversGroup(info, group)) || info.resource === group);
}

export function isResourceKindKey(key: string): key is ResourceKindKey {
  return key in resourceKindInfos;
}

const allKindKeys = Object.keys(resourceKindInfos).filter(isResourceKindKey);

/**
 * Look up a kind's registry key from a resource or a job summary row, which carry both the API group
 * (`dashboard.grafana.app`) and the Kubernetes Kind (`Dashboard`). Matches on whichever identifiers
 * are present so partially-populated summary rows still resolve.
 */
export function getKindKeyByGroupKind(group?: string, kind?: string): ResourceKindKey | undefined {
  if (!group && !kind) {
    return undefined;
  }
  return allKindKeys.find((key) => {
    const info: ResourceKindInfo = resourceKindInfos[key];
    return (!group || coversGroup(info, group)) && (!kind || info.kind === kind);
  });
}

/** Look up a kind from a resource or a job summary row; see {@link getKindKeyByGroupKind}. */
export function getKindInfoByGroupKind(group?: string, kind?: string): ResourceKindInfo | undefined {
  const key = getKindKeyByGroupKind(group, kind);
  return key && resourceKindInfos[key];
}

/**
 * Look up a kind from a resource-stat entry (`ResourceCount`), which carries both
 * an API `group` and a plural `resource` name. The plural resource uniquely
 * identifies the kind even when kinds share a group, so we match on it first and
 * fall back to a group-only match for stats that omit the resource.
 */
export function getKindInfoByStat(stat: { group?: string; resource?: string }): ResourceKindInfo | undefined {
  const byResource = allKindInfos.find((info) => info.resource === stat.resource);
  if (byResource) {
    return byResource;
  }
  return getKindInfoByStatGroup(stat.group);
}

/**
 * Resolves which kinds the backend currently exposes for provisioning, gating on
 * the config-derived `availableResources` from the settings endpoint. Disabled
 * kinds (declared but not acted on) are excluded.
 *
 * When `availableResources` is unset (e.g. settings not loaded yet) we fall back
 * to the full registry as a best-effort default — this can include kinds the
 * backend currently ships disabled (e.g. playlists), so callers that must respect
 * the disabled state should wait for `availableResources` to be populated.
 */
export function getAvailableResourceKinds(availableResources?: SupportedResource[]): ResourceKindInfo[] {
  if (!availableResources) {
    return allKindInfos;
  }
  return allKindInfos.filter((info) =>
    availableResources.some(
      (r) => r.group !== undefined && coversGroup(info, r.group) && r.kind === info.kind && !r.disabled
    )
  );
}

/** Whether a given kind is currently enabled for provisioning per the settings endpoint. */
export function isResourceKindAvailable(info: ResourceKindInfo, availableResources?: SupportedResource[]): boolean {
  // Compare on group/kind rather than object identity so callers can pass an
  // equivalent descriptor that isn't the exact registry instance.
  return getAvailableResourceKinds(availableResources).some(
    (available) => available.group === info.group && available.kind === info.kind
  );
}

/**
 * The kinds offered for migration on this instance: every registered kind except
 * folders (the container others nest under).
 *
 * Once `availableResources` is loaded the backend is authoritative for every
 * kind: only kinds it reports active are returned, so an overridden
 * `[provisioning] resources` config that omits or disables a kind (even
 * dashboards) is honored. Before settings load (`availableResources` undefined)
 * we fall back to the static base (`alwaysAvailable`, i.e. dashboards) so the
 * common case isn't blank during the initial render. Each returned kind knows
 * how to `list()` itself.
 */
export function getMigratableKinds(availableResources?: SupportedResource[]): ResourceKindInfo[] {
  return allKindInfos.filter((info) => {
    if (info.kind === resourceKindInfos.folder.kind) {
      return false;
    }
    return availableResources ? isResourceKindAvailable(info, availableResources) : info.alwaysAvailable;
  });
}

// --- Resource enumeration -------------------------------------------------
// How each kind lists itself, backing the `list()` methods above. Kept here so
// the registry stays the single place that knows how to enumerate each kind.

const PAGE_SIZE = 200;
// How many page requests to have in flight at once, so a large instance doesn't
// fire hundreds of concurrent requests on load.
const PAGE_CONCURRENCY = 5;
// Guardrail so a pathological response can't spin off unbounded requests.
// Exceeding it throws rather than returning a silently truncated list.
const MAX_PAGES = 200;

/**
 * The unified searcher reports a resource's immediate parent folder UID in
 * `item.location`. Root-level resources come back empty or as the literal
 * "general" UID — normalize both to undefined. Although `location` is declared as
 * a string, a folderless resource yields it absent at runtime, so this tolerates
 * undefined: calling .trim() on a missing location would throw and reject the
 * whole enumeration.
 */
export function readImmediateParent(location: string | undefined): string | undefined {
  const trimmed = location?.trim();
  if (!trimmed || trimmed === GENERAL_FOLDER_UID) {
    return undefined;
  }
  return trimmed;
}

/**
 * Pages through every item of a search kind via the unified searcher, fetching
 * the pages after the first in small concurrent batches. Bounded by MAX_PAGES;
 * fails loudly rather than truncating, since a partial list would drop rows from
 * the migrate table and its payload.
 */
async function fetchAllSearchPages(searchKind: string): Promise<DashboardQueryResult[]> {
  const searcher = getGrafanaSearcher();
  const searchPage = (page: number) =>
    searcher.search({
      kind: [searchKind],
      query: '*',
      from: page * PAGE_SIZE,
      offset: page * PAGE_SIZE,
      limit: PAGE_SIZE,
    });

  const first = await searchPage(0);
  const items: DashboardQueryResult[] = first.view.toArray();
  const pageCount = Math.max(1, Math.ceil(first.totalRows / PAGE_SIZE));
  if (pageCount > MAX_PAGES) {
    throw new Error(`Too many ${searchKind}s to enumerate (${first.totalRows}); aborting to avoid an incomplete list.`);
  }

  for (let page = 1; page < pageCount; page += PAGE_CONCURRENCY) {
    const batch = Array.from({ length: Math.min(PAGE_CONCURRENCY, pageCount - page) }, (_, index) =>
      searchPage(page + index)
    );
    for (const result of await Promise.all(batch)) {
      items.push(...result.view.toArray());
    }
  }
  return items;
}

/**
 * Lists a kind the unified search index serves (dashboards, folders). The search
 * index only serves folder-scoped kinds, so the parent folder is always read.
 */
async function listViaSearch(searchKind: string): Promise<ListedResource[]> {
  const items = await fetchAllSearchPages(searchKind);
  return items.map((item) => {
    const view = queryResultToViewItem(item);
    return {
      uid: view.uid,
      title: view.title,
      parentUid: readImmediateParent(item.location),
      managed: Boolean(view.managedBy),
    };
  });
}

interface ApiserverListItem {
  metadata?: { name?: string; annotations?: Record<string, string> };
  spec?: { title?: string; readOnly?: boolean };
}

/**
 * Lists a kind through its apiserver collection — for kinds the unified search
 * index doesn't serve (e.g. playlists). Read directly (not via an RTK client) so
 * any kind can be listed from its group/version/resource without a bespoke
 * client.
 */
/** Maps an apiserver list response into ListedResources: name as uid, spec title (falling back to
 * the name), parent folder, manager presence; entries without a name dropped. */
function toListedResources(items: ApiserverListItem[] | undefined): ListedResource[] {
  return (items ?? [])
    .map((item) => ({
      uid: item.metadata?.name ?? '',
      title: item.spec?.title || item.metadata?.name || '',
      parentUid: readImmediateParent(item.metadata?.annotations?.[AnnoKeyFolder]),
      // Classic file provisioning marks a data source read-only without a manager annotation, so
      // the annotation alone would offer a resource no write can take over.
      managed: isManaged(item) || item.spec?.readOnly === true,
    }))
    .filter((row) => row.uid);
}

async function listViaApiserver(group: string, version: string, resource: string): Promise<ListedResource[]> {
  const url = `${getAPIBaseURL(group, version)}/${resource}`;
  const response = await getBackendSrv().get<{ items?: ApiserverListItem[] }>(url);
  return toListedResources(response.items);
}

/**
 * Whether provisioning acts on a member of a collection it covers. A member declared on its own
 * wins over the collection, disabled or not: that is the precedence job admission applies, so a
 * member enumerated against it would be offered for migration and then rejected.
 *
 * Membership is already established, so a declaration covers the member only by naming the
 * collection or the member itself -- a sibling's group covers nothing here.
 *
 * A pattern restricted to some of a collection's members is reported as the plain collection, so
 * the members it excludes cannot be told from the ones it covers and are listed too.
 */
function actsOnMember(
  collection: string,
  group: string,
  kind: string,
  availableResources?: SupportedResource[]
): boolean {
  if (!availableResources) {
    return true;
  }
  const declared = availableResources.find((r) => r.kind === kind && r.group === group);
  if (declared) {
    return !declared.disabled;
  }
  return availableResources.some((r) => r.kind === kind && r.group === collection && !r.disabled);
}

/**
 * Lists a collection's members, through each of the groups serving the kind: a member has to be
 * reported with the group that serves it, which the collection group does not name. Discovery is
 * the source, as it is for the backend's own expansion, because a plugin can be installed without
 * its group being served.
 */
async function listCollectionMembers(
  collection: string,
  resource: string,
  kind: string,
  availableResources?: SupportedResource[]
): Promise<ListedResource[]> {
  const apis = await getAPIGroupDiscoveryList();
  const perGroup = await Promise.all(
    apis.items
      .filter((api) => api.metadata.name.endsWith(`.${collection}`))
      .flatMap((api) => {
        if (!actsOnMember(collection, api.metadata.name, kind, availableResources)) {
          return [];
        }
        // Versions are listed preferred-first.
        const version = api.versions.find((v) => v.resources.some((r) => r.resource === resource));
        return version ? [{ group: api.metadata.name, version: version.version }] : [];
      })
      .map(async ({ group, version }) => {
        const listed = await listViaApiserver(group, version, resource);
        return listed.map((item) => ({ ...item, group }));
      })
  );
  return perGroup.flat();
}

/**
 * Lists playlists through their generated RTK Query client, read imperatively so
 * the registry's list() stays a plain function. Using the client (rather than a
 * raw request) keeps the v1→v0alpha1 fallback and the shared base query.
 */
async function listPlaylists(dispatch: AppDispatch): Promise<ListedResource[]> {
  const response = await dispatch(
    playlistAPIv1.endpoints.listPlaylist.initiate({}, { forceRefetch: true, subscribe: false })
  ).unwrap();
  return toListedResources(response.items);
}
