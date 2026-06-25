import { t } from '@grafana/i18n';
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
 * Pages through every item of a kind via the unified searcher. The first page
 * reports `totalRows`, so the remaining pages are fetched in small concurrent
 * batches (PAGE_CONCURRENCY) rather than one sequential round-trip at a time or
 * one big burst. Bounded by MAX_PAGES.
 *
 * Only the unified-search kinds (`folder`, `dashboard`) go through here; other
 * kinds list through their own API (see the per-kind listers below).
 */
async function fetchAllPages(kind: 'folder' | 'dashboard'): Promise<DashboardQueryResult[]> {
  const searcher = getGrafanaSearcher();
  const searchPage = (page: number) =>
    searcher.search({
      kind: [kind],
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
    throw new Error(`Too many ${kind}s to enumerate (${totalRows}); aborting to avoid an incomplete migration list.`);
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
 * `kind: ['folder']` returns every folder on the instance; we only need each
 * folder's UID and title to label the rows that folder-scoped kinds nest under.
 */
export async function fetchAllFolders(): Promise<Array<{ uid: string; title: string }>> {
  const items = await fetchAllPages('folder');
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

/**
 * A migratable resource kind paired with how to enumerate it. The registry below
 * is the single place new kinds plug into the migrate UI: add an entry and the
 * enumeration, table rows, stat cards, and selection payload pick it up
 * generically. Each kind lists differently (dashboards come from the unified
 * search index; playlists from their own apiserver list), so the `list` function
 * encapsulates that per-kind difference behind one shape.
 */
export interface MigrationSource {
  kind: ResourceKindInfo;
  /**
   * True for kinds in the static provisioning base (folder + dashboard), which
   * the backend always supports — so they're enumerated regardless of
   * `availableResources`. Other kinds are gated on it.
   */
  alwaysAvailable?: boolean;
  list: (deps: ListerDeps) => Promise<RawMigratable[]>;
}

async function listDashboards(): Promise<RawMigratable[]> {
  const items = await fetchAllPages('dashboard');
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
 * Registry of the resource kinds the migrate UI can enumerate, each with how to
 * list it. Folders are intentionally absent: they're the container the
 * folder-scoped kinds nest under, not a migratable content kind here. Adding a
 * kind (e.g. library panels) is one entry plus a `list` implementation — and,
 * for kinds the unified search index doesn't serve, that means a dedicated API
 * list rather than `fetchAllPages`.
 */
export const migrationSources: MigrationSource[] = [
  { kind: resourceKindInfos.dashboard, alwaysAvailable: true, list: () => listDashboards() },
  { kind: resourceKindInfos.playlist, list: (deps) => listPlaylists(deps) },
];

/**
 * The sources to enumerate for this instance: those in the static base plus any
 * other kind the backend currently reports as available for provisioning. The
 * availability check is strict — it requires `availableResources` to be
 * populated — so a kind the backend ships disabled never appears until settings
 * load and confirm it.
 */
export function activeMigrationSources(availableResources?: SupportedResource[]): MigrationSource[] {
  return migrationSources.filter(
    (source) =>
      source.alwaysAvailable ||
      (Boolean(availableResources) && isResourceKindAvailable(source.kind, availableResources))
  );
}

/**
 * Human, pluralized label for a kind, used for stat-card titles and the
 * synthetic folder row that groups a non-folder kind. i18n keys must be static
 * for extraction, so this is a switch with a per-kind key rather than a lookup;
 * unknown kinds fall back to the registry's item-type label.
 */
export function kindPluralLabel(kind: ResourceKindInfo): string {
  switch (kind.kind) {
    case resourceKindInfos.dashboard.kind:
      return t('provisioning.migrate.dashboards', 'Dashboards');
    case resourceKindInfos.playlist.kind:
      return t('provisioning.migrate.playlists', 'Playlists');
    default:
      return kind.itemType;
  }
}
