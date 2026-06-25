import { playlistAPIv1 } from 'app/api/clients/playlist/v1';
import { type SupportedResource } from 'app/api/clients/provisioning/v0alpha1';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { type DashboardQueryResult } from 'app/features/search/service/types';
import { queryResultToViewItem } from 'app/features/search/service/utils';
import { type AppDispatch } from 'app/store/configureStore';

import { isManaged } from '../../utils/managedResource';
import { type ResourceKindInfo, isResourceKindAvailable, resourceKindInfos } from '../../utils/resourceKinds';

const PAGE_SIZE = 200;
// How many page requests of one kind to have in flight at once. Keeps the
// fan-out bounded (each kind batches independently) so a large instance doesn't
// fire hundreds of concurrent requests on load.
const PAGE_CONCURRENCY = 5;
// Safety guardrail so a pathological response (or an enormous instance) can't
// spin off unbounded requests. Generous on purpose — well past any realistic
// folder/dashboard count. Exceeding it throws (rather than returning a
// truncated list) so the page fails loudly; the proper fix is a backend
// roll-up the source's caller points at.
const MAX_PAGES = 200;

/**
 * The unified searcher reports a resource's *immediate* parent folder UID in
 * `item.location`. Root-level resources come back with an empty UID or the
 * literal "general" UID; normalize both to undefined.
 */
export function readImmediateParent(location: string): string | undefined {
  const trimmed = location.trim();
  if (!trimmed || trimmed === GENERAL_FOLDER_UID) {
    return undefined;
  }
  return trimmed;
}

/**
 * Pages through every item of a search kind via the unified searcher. The first
 * page reports `totalRows`, so the remaining pages are fetched in small
 * concurrent batches (PAGE_CONCURRENCY) rather than one sequential round-trip at
 * a time or one big burst. Bounded by MAX_PAGES. Only kinds the search index
 * serves go through here (`ResourceKindInfo.searchable`).
 */
async function fetchAllPages(searchKind: string): Promise<DashboardQueryResult[]> {
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
  const totalRows = first.totalRows;
  const pageCount = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));

  // Fail loudly rather than silently truncating: a partial list would drop rows
  // from the table and, worse, from the selective-migration payload.
  if (pageCount > MAX_PAGES) {
    throw new Error(
      `Too many ${searchKind}s to enumerate (${totalRows}); aborting to avoid an incomplete migration list.`
    );
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

// The unified search index keys a kind by its lowercased Kind ("Dashboard" →
// "dashboard", "Folder" → "folder").
function searchKindFor(info: ResourceKindInfo): string {
  return info.kind.toLowerCase();
}

/**
 * `folder` is searchable, so folders list through the search index; we only need
 * each folder's UID and title to label the rows that folder-scoped kinds nest
 * under.
 */
export async function fetchAllFolders(): Promise<Array<{ uid: string; title: string }>> {
  const items = await fetchAllPages(searchKindFor(resourceKindInfos.folder));
  return items.map((item) => ({ uid: item.uid, title: item.name }));
}

/**
 * A resource of some kind, before it's grouped into the migration table. The
 * generic aggregation decides where it lands from its kind: folder-scoped kinds
 * nest under `parentUid`; others are grouped under a synthetic per-kind row.
 */
export interface RawMigratable {
  uid: string;
  title: string;
  /** Immediate parent folder UID; undefined for root or non-folder-scoped kinds. */
  parentUid?: string;
  /** Already owned by a manager (Git Sync, Terraform, …) — not a migration target. */
  managed: boolean;
}

interface ListerDeps {
  dispatch: AppDispatch;
}

type Lister = (deps: ListerDeps) => Promise<RawMigratable[]>;

/**
 * A migratable kind paired with how to enumerate it. The kind's identity, label,
 * containment, and availability all come from the `ResourceKindInfo` registry —
 * this only adds the one thing the registry can't carry: the data-fetching
 * `list` function (which pulls in the searcher / per-kind API clients).
 */
export interface MigrationSource {
  kind: ResourceKindInfo;
  list: Lister;
}

/** Lists a searchable kind (dashboards) through the unified search index. */
async function listViaSearch(info: ResourceKindInfo): Promise<RawMigratable[]> {
  const items = await fetchAllPages(searchKindFor(info));
  return items.map((item) => {
    const view = queryResultToViewItem(item);
    return {
      uid: view.uid,
      title: view.title,
      parentUid: info.folderScoped ? readImmediateParent(item.location) : undefined,
      managed: Boolean(view.managedBy),
    };
  });
}

/** Lists playlists through the playlist apiserver list. */
async function listPlaylists({ dispatch }: ListerDeps): Promise<RawMigratable[]> {
  // Read imperatively (not via the React-Query hook) so the generic hook can
  // iterate kinds in a plain loop. forceRefetch keeps a manual refetch honest;
  // subscribe:false avoids leaving a dangling cache subscription behind.
  const response = await dispatch(
    playlistAPIv1.endpoints.listPlaylist.initiate({}, { forceRefetch: true, subscribe: false })
  ).unwrap();

  return (response.items ?? [])
    .map((playlist) => ({
      uid: playlist.metadata?.name ?? '',
      title: playlist.spec?.title || playlist.metadata?.name || '',
      managed: isManaged(playlist),
    }))
    .filter((row) => row.uid);
}

/**
 * Listers for kinds the unified search index doesn't serve (`searchable: false`),
 * keyed by Kubernetes Kind. Each such kind needs its own API list; this map is
 * the only per-kind code adding a kind requires (searchable kinds list
 * generically). Adding library panels, for example, is one entry here.
 */
const nonSearchListers: Partial<Record<string, Lister>> = {
  [resourceKindInfos.playlist.kind]: listPlaylists,
};

function listerFor(info: ResourceKindInfo): Lister | undefined {
  if (info.searchable) {
    return () => listViaSearch(info);
  }
  return nonSearchListers[info.kind];
}

/**
 * The migration sources for this instance, derived from the kind registry: every
 * registered kind except folders (the container others nest under), that is both
 * available — in the static base (`alwaysAvailable`) or reported by the backend's
 * `availableResources` — and has a known way to be listed. The availability check
 * is strict: a non-base kind only appears once `availableResources` is populated
 * and confirms it, so a kind the backend ships disabled never shows up early.
 */
export function activeMigrationSources(availableResources?: SupportedResource[]): MigrationSource[] {
  const sources: MigrationSource[] = [];
  for (const info of Object.values(resourceKindInfos)) {
    if (info.kind === resourceKindInfos.folder.kind) {
      continue;
    }
    const available =
      info.alwaysAvailable || (Boolean(availableResources) && isResourceKindAvailable(info, availableResources));
    if (!available) {
      continue;
    }
    const list = listerFor(info);
    if (!list) {
      // Available, but we don't yet know how to enumerate it (no lister). Skip
      // rather than guess — adding one is a `nonSearchListers` entry above.
      continue;
    }
    sources.push({ kind: info, list });
  }
  return sources;
}
