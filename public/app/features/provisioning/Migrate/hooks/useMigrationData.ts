import { useCallback, useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { useDispatch } from 'app/types/store';

import { isAppGeneratedResource } from '../../utils/managedResource';
import { type ListedResource, type ResourceKindInfo, resourceKindInfos } from '../../utils/resourceKinds';

/**
 * A single resource that can be migrated, tagged with its kind so the selection
 * payload and row icon are resolved from the registry rather than hardcoded. The
 * table is kind-agnostic: folder-scoped kinds (dashboards) live under their
 * folder, while kinds that don't support folders (e.g. playlists) are grouped
 * under a synthetic folder row.
 */
export interface MigratableResource {
  uid: string;
  title: string;
  kind: ResourceKindInfo;
}

/**
 * Stable selection key for a resource. A Kubernetes `metadata.name` is only
 * unique within a group/kind, so a dashboard and a playlist can share a uid;
 * keying selection on the uid alone would conflate them. Qualifying by
 * group/kind keeps different kinds from ever colliding.
 */
export function resourceKey(resource: MigratableResource): string {
  return `${resource.kind.group}/${resource.kind.kind}/${resource.uid}`;
}

export interface FolderRow {
  uid: string;
  title: string;
  /**
   * Titles of the ancestor folders above this one, outermost first and excluding
   * the folder itself. Shown as a breadcrumb so folders that share a name (e.g.
   * two "Team" subfolders in different parents) can be told apart. Empty for
   * root-level folders, the synthetic General row, and non-folder synthetic rows.
   */
  path: string[];
  /**
   * UID of the parent folder, used to nest rows into a tree. Undefined for
   * root-level folders, the synthetic General row, and non-folder synthetic rows.
   */
  parentUid?: string;
  /** Number of unmanaged resources directly in this folder. */
  resourceCount: number;
  /**
   * The unmanaged resources directly in this folder. Selective migration is
   * not recursive — resources in subfolders are migrated through their own
   * folder's row, not this one.
   */
  directResources: MigratableResource[];
}

interface State {
  data: FolderRow[];
  /**
   * Ancestor folders that hold no resources directly but sit above folders that
   * do (e.g. "Users" above "florie.cai"). They exist only so the table can render
   * the folder hierarchy; they are never migrated on their own, so they stay out
   * of `data`.
   */
  containers: FolderRow[];
  isLoading: boolean;
  isError: boolean;
  /**
   * Kinds whose list() rejected while others succeeded. The table is incomplete
   * but still useful; callers surface this so a partial list isn't mistaken for
   * the full set (e.g. before treating "select all" as "migrate everything").
   */
  failedKinds: ResourceKindInfo[];
}

interface KindResult {
  kind: ResourceKindInfo;
  raw: ListedResource[];
}

/** Synthetic folder UID for a non-folder kind. Namespaced so it can't collide
 * with a real folder uid. */
function syntheticFolderUid(kind: ResourceKindInfo): string {
  return `__migrate_${kind.kind.toLowerCase()}__`;
}

/**
 * Walks the parent chain of a folder and returns its ancestor titles, outermost
 * first and excluding the folder itself. Missing ancestors (a parent not present
 * in the listed folders) end the walk; a `seen` guard keeps a malformed cyclic
 * parent reference from looping forever.
 */
function ancestorTitles(uid: string, folderByUid: Map<string, ListedResource>): string[] {
  // Collected innermost-first while walking up, then reversed once so the walk
  // stays linear (unshift-per-step would be O(depth²)).
  const titles: string[] = [];
  const seen = new Set<string>([uid]);
  let parentUid = folderByUid.get(uid)?.parentUid;
  while (parentUid && !seen.has(parentUid)) {
    seen.add(parentUid);
    const parent = folderByUid.get(parentUid);
    if (!parent) {
      break;
    }
    titles.push(parent.title);
    parentUid = parent.parentUid;
  }
  return titles.reverse();
}

/**
 * Builds empty rows for the ancestors of `rows` that aren't rows themselves, so
 * the table can nest a folder under its parents. The walk up stops at the first
 * ancestor that is already a row or container, since its own ancestors were
 * handled when it was added.
 */
function collectContainers(rows: FolderRow[], folderByUid: Map<string, ListedResource>): FolderRow[] {
  const known = new Set(rows.map((row) => row.uid));
  const containers: FolderRow[] = [];
  for (const row of rows) {
    const seen = new Set<string>([row.uid]);
    let parentUid = row.parentUid;
    while (parentUid && !known.has(parentUid) && !seen.has(parentUid)) {
      seen.add(parentUid);
      const parent = folderByUid.get(parentUid);
      if (!parent) {
        break;
      }
      known.add(parentUid);
      containers.push({
        uid: parentUid,
        title: parent.title,
        path: ancestorTitles(parentUid, folderByUid),
        parentUid: parent.parentUid,
        resourceCount: 0,
        directResources: [],
      });
      parentUid = parent.parentUid;
    }
  }
  return containers;
}

/**
 * Joins the enumerated resources into the per-folder table the UI renders.
 * Folder-scoped kinds nest under the folder that directly contains them (and
 * roll up at the root into a synthetic "General" row); non-folder kinds get one
 * synthetic folder row per kind. Already-managed resources are dropped — the
 * migrate backend only takes unmanaged ones. App-generated resources (e.g. the
 * SLO app's dashboards/folders) are dropped too: the backend export skips them,
 * so offering them as selectable here would let a user pick resources that never
 * actually migrate. Folders with nothing to migrate are left out of `rows`, apart
 * from the ancestors of folders that do have something, returned as `containers`.
 */
function aggregate(folders: ListedResource[], results: KindResult[]): { rows: FolderRow[]; containers: FolderRow[] } {
  const folderByUid = new Map(
    folders.filter((folder) => !isAppGeneratedResource(folder.uid)).map((folder) => [folder.uid, folder])
  );
  const directByFolder = new Map<string, MigratableResource[]>();
  const rootResources: MigratableResource[] = [];
  const syntheticRows: FolderRow[] = [];

  for (const { kind, raw } of results) {
    const unmanaged = raw.filter((r) => !r.managed && !isAppGeneratedResource(r.uid));

    if (!kind.folderScoped) {
      if (unmanaged.length > 0) {
        syntheticRows.push({
          uid: syntheticFolderUid(kind),
          title: kind.pluralLabel(),
          path: [],
          resourceCount: unmanaged.length,
          directResources: unmanaged.map((r) => ({ uid: r.uid, title: r.title, kind })),
        });
      }
      continue;
    }

    for (const r of unmanaged) {
      const item: MigratableResource = { uid: r.uid, title: r.title, kind };
      if (!r.parentUid) {
        rootResources.push(item);
        continue;
      }
      const existing = directByFolder.get(r.parentUid);
      if (existing) {
        existing.push(item);
      } else {
        directByFolder.set(r.parentUid, [item]);
      }
    }
  }

  const rows: FolderRow[] = [];
  for (const [uid, directResources] of directByFolder) {
    rows.push({
      uid,
      title: folderByUid.get(uid)?.title ?? uid,
      path: ancestorTitles(uid, folderByUid),
      parentUid: folderByUid.get(uid)?.parentUid,
      resourceCount: directResources.length,
      directResources,
    });
  }
  const containers = collectContainers(rows, folderByUid);
  if (rootResources.length > 0) {
    rows.push({
      uid: GENERAL_FOLDER_UID,
      title: t('provisioning.migrate.general-folder-title', 'General (root resources)'),
      path: [],
      resourceCount: rootResources.length,
      directResources: rootResources,
    });
  }
  rows.push(...syntheticRows);

  // Default ordering: most resources first so the folders with the most to
  // migrate surface at the top, then by title. The table lets the user re-sort.
  rows.sort((a, b) => {
    if (b.resourceCount !== a.resourceCount) {
      return b.resourceCount - a.resourceCount;
    }
    // Folder lists are O(folders) — small enough to use localeCompare directly.
    // eslint-disable-next-line @grafana/no-locale-compare
    return a.title.localeCompare(b.title);
  });
  return { rows, containers };
}

/**
 * Enumerates the unmanaged resources to migrate across the given kinds and joins
 * them into the per-folder table. Each kind knows how to `list()` itself (see the
 * resource-kind registry), so this hook is generic — adding a kind is a registry
 * entry, not a change here. Folders are listed once to label the rows that
 * folder-scoped kinds nest under. When a dedicated backend roll-up endpoint
 * lands, swap the body to consume it.
 */
export function useMigrationData(kinds: ResourceKindInfo[]): State & { refetch: () => void } {
  const dispatch = useDispatch();
  const [state, setState] = useState<State>({
    data: [],
    containers: [],
    isLoading: true,
    isError: false,
    failedKinds: [],
  });
  const [reloadToken, setReloadToken] = useState(0);

  // Identity-stable dependency: the kinds list is rebuilt each render, so key the
  // effect on the kinds it covers rather than the array reference.
  const kindsKey = kinds.map((kind) => `${kind.group}/${kind.kind}`).join(',');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const needsFolders = kinds.some((kind) => kind.folderScoped);
      // Enumerate folders (for labels) and each kind independently. A single kind
      // failing to list — an apiserver that's unavailable, a client that rejects —
      // must not blank the whole table: keep the kinds that succeeded and only
      // fall back to the error state when nothing could be loaded at all.
      const outcomes = await Promise.allSettled([
        // Folders list through the searcher and ignore dispatch.
        needsFolders ? resourceKindInfos.folder.list() : Promise.resolve<ListedResource[]>([]),
        ...kinds.map((kind) => kind.list({ dispatch })),
      ]);
      if (cancelled) {
        return;
      }

      const [folderOutcome, ...kindOutcomes] = outcomes;
      const folders = folderOutcome.status === 'fulfilled' ? folderOutcome.value : [];
      const results: KindResult[] = [];
      const failedKinds: ResourceKindInfo[] = [];
      kinds.forEach((kind, index) => {
        const outcome = kindOutcomes[index];
        if (outcome.status === 'fulfilled') {
          results.push({ kind, raw: outcome.value });
        } else {
          failedKinds.push(kind);
        }
      });

      // The folder request only supplies labels, so a folder-only success does
      // not count as a successful enumeration. Surface the error fallback when
      // there were kinds to load and every one of them failed; a partial success
      // still renders what loaded (with failedKinds reported for awareness).
      const isError = kinds.length > 0 && results.length === 0;
      const { rows, containers } = isError ? { rows: [], containers: [] } : aggregate(folders, results);
      setState({
        data: rows,
        containers,
        isLoading: false,
        isError,
        failedKinds,
      });
    })();
    return () => {
      cancelled = true;
    };
    // kindsKey captures the meaningful contents of `kinds`; dispatch is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kindsKey, reloadToken, dispatch]);

  // Refetch in the background — we don't flip back to the loading state, so a
  // post-migration refresh doesn't unmount the page (and the drawer that
  // triggered it); the rows just update once the new data lands.
  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { ...state, refetch };
}
