import { useCallback, useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { useDispatch } from 'app/types/store';

import { type ResourceKindInfo } from '../../utils/resourceKinds';

import { type MigrationSource, type RawMigratable, fetchAllFolders } from './migrationSources';

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
  isLoading: boolean;
  isError: boolean;
}

interface SourceResult {
  source: MigrationSource;
  raw: RawMigratable[];
}

/** Synthetic folder UID for a non-folder kind. Namespaced so it can't collide
 * with a real folder uid. */
function syntheticFolderUid(kind: ResourceKindInfo): string {
  return `__migrate_${kind.kind.toLowerCase()}__`;
}

/**
 * Joins the enumerated resources into the per-folder table the UI renders.
 * Folder-scoped kinds nest under the folder that directly contains them (and
 * roll up at the root into a synthetic "General" row); non-folder kinds get one
 * synthetic folder row per kind. Already-managed resources are dropped — the
 * migrate backend only takes unmanaged ones. Folders with nothing to migrate are
 * left out entirely.
 */
function aggregate(folders: Array<{ uid: string; title: string }>, results: SourceResult[]): FolderRow[] {
  const folderTitle = new Map(folders.map((folder) => [folder.uid, folder.title]));
  const directByFolder = new Map<string, MigratableResource[]>();
  const rootResources: MigratableResource[] = [];
  const syntheticRows: FolderRow[] = [];

  for (const { source, raw } of results) {
    const kind = source.kind;
    const unmanaged = raw.filter((r) => !r.managed);

    if (!kind.folderScoped) {
      if (unmanaged.length > 0) {
        syntheticRows.push({
          uid: syntheticFolderUid(kind),
          title: kind.pluralLabel(),
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
      title: folderTitle.get(uid) ?? uid,
      resourceCount: directResources.length,
      directResources,
    });
  }
  if (rootResources.length > 0) {
    rows.push({
      uid: GENERAL_FOLDER_UID,
      title: t('provisioning.migrate.general-folder-title', 'General (root resources)'),
      resourceCount: rootResources.length,
      directResources: rootResources,
    });
  }
  rows.push(...syntheticRows);

  // Default ordering: most resources first so the folders with the most to
  // migrate surface at the top, then by title. The table lets the user re-sort.
  return rows.sort((a, b) => {
    if (b.resourceCount !== a.resourceCount) {
      return b.resourceCount - a.resourceCount;
    }
    // Folder lists are O(folders) — small enough to use localeCompare directly.
    // eslint-disable-next-line @grafana/no-locale-compare
    return a.title.localeCompare(b.title);
  });
}

/**
 * Enumerates the unmanaged resources to migrate across every active kind and
 * joins them into the per-folder table. Each kind lists through its own
 * `MigrationSource` (the unified search index for dashboards, the apiserver list
 * for playlists, …), so adding a kind is a registry entry rather than a new hook
 * here. Folders are fetched once to label the rows that folder-scoped kinds nest
 * under. When a dedicated backend roll-up endpoint lands, swap the body to
 * consume it.
 */
export function useMigrationData(sources: MigrationSource[]): State & { refetch: () => void } {
  const dispatch = useDispatch();
  const [state, setState] = useState<State>({
    data: [],
    isLoading: true,
    isError: false,
  });
  const [reloadToken, setReloadToken] = useState(0);

  // Identity-stable dependency: the source list is rebuilt each render, so key
  // the effect on the kinds it covers rather than the array reference.
  const sourcesKey = sources.map((source) => `${source.kind.group}/${source.kind.kind}`).join(',');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const needsFolders = sources.some((source) => source.kind.folderScoped);
        const [folders, rawResults] = await Promise.all([
          needsFolders ? fetchAllFolders() : Promise.resolve<Array<{ uid: string; title: string }>>([]),
          Promise.all(sources.map((source) => source.list({ dispatch }))),
        ]);
        if (cancelled) {
          return;
        }
        const results = sources.map((source, index) => ({ source, raw: rawResults[index] }));
        setState({ data: aggregate(folders, results), isLoading: false, isError: false });
      } catch (err) {
        if (!cancelled) {
          setState({ data: [], isLoading: false, isError: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // sourcesKey captures the meaningful contents of `sources`; dispatch is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcesKey, reloadToken, dispatch]);

  // Refetch in the background — we don't flip back to the loading state, so a
  // post-migration refresh doesn't unmount the page (and the drawer that
  // triggered it); the rows just update once the new data lands.
  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { ...state, refetch };
}
