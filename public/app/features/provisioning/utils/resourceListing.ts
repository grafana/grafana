import { getBackendSrv } from '@grafana/runtime';
import { playlistAPIv1 } from 'app/api/clients/playlist/v1';
import { type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';
import { getAPIBaseURL } from 'app/api/utils';
import { getAPIGroupDiscoveryList } from 'app/features/apiserver/discovery';
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

/** Dependencies a kind's enumeration may need. `dispatch` lets a kind read through
 * an RTK Query client imperatively. */
export interface ResourceListDeps {
  dispatch: AppDispatch;
  /**
   * The backend's declared resources, so a collection kind enumerates only the members provisioning
   * acts on. Undefined before settings load, which enumerates every member served.
   */
  availableResources?: SupportedResource[];
}

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
export async function listViaSearch(searchKind: string): Promise<ListedResource[]> {
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

/** Maps an apiserver list response into ListedResources: name as uid, spec title
 * (falling back to the name), manager presence; entries without a name dropped. */
function toListedResources(items: ApiserverListItem[] | undefined): ListedResource[] {
  return (items ?? [])
    .map((item) => ({
      uid: item.metadata?.name ?? '',
      title: item.spec?.title || item.metadata?.name || '',
      // Classic file provisioning marks a data source read-only without a manager annotation, so
      // the annotation alone would offer a resource no write can take over.
      managed: isManaged(item) || item.spec?.readOnly === true,
    }))
    .filter((row) => row.uid);
}

/**
 * Lists a kind through its apiserver collection — for kinds the unified search
 * index doesn't serve (e.g. library panels). Read directly (not via an RTK client)
 * so any kind can be listed from its group/version/resource without a bespoke
 * client. These kinds are org-scoped, so no parent folder is resolved.
 */
export async function listViaApiserver(group: string, version: string, resource: string): Promise<ListedResource[]> {
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
export async function listCollectionMembers(
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
 * the registry's source stays declarative. Using the client (rather than a raw
 * request) keeps the v1→v0alpha1 fallback and the shared base query.
 */
export async function listPlaylists(dispatch: AppDispatch): Promise<ListedResource[]> {
  const response = await dispatch(
    playlistAPIv1.endpoints.listPlaylist.initiate({}, { forceRefetch: true, subscribe: false })
  ).unwrap();
  return toListedResources(response.items);
}
