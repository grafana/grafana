import { useCallback, useEffect, useState } from 'react';

import { t } from '@grafana/i18n';
import { type ResourceListItem } from 'app/api/clients/provisioning/v0alpha1';
import { GENERAL_FOLDER_UID } from 'app/features/search/constants';
import { useDispatch } from 'app/types/store';

import { isAppGeneratedResource } from '../../utils/managedResource';
import { listNamespaceResources } from '../../utils/namespaceResources';
import {
  type ResourceKindInfo,
  getKindInfoByGroupResource,
  readImmediateParent,
  resolveCollectionMembers,
  resolveKindNames,
  resourceKeyOf,
  resourceKindInfos,
} from '../../utils/resourceKinds';

/**
 * A single resource that can be migrated. The table is kind-agnostic: folder-scoped kinds live
 * under their folder, while kinds that don't support folders (e.g. playlists) are grouped under a
 * synthetic folder row.
 */
export interface MigratableResource {
  uid: string;
  title: string;
  /** The group a migrate job addresses this resource through. */
  group: string;
  /** Plural resource name, as the namespace list reported it. */
  resource: string;
  /** Kubernetes Kind; the migrate job addresses a resource by it. Empty when nothing could resolve it. */
  kind: string;
  /** Registry entry for this kind, when the UI has one. */
  info?: ResourceKindInfo;
}

/**
 * Stable selection key for a resource. A Kubernetes `metadata.name` is only
 * unique within a group/kind, so a dashboard and a playlist can share a uid;
 * keying selection on the uid alone would conflate them. Qualifying by
 * group/resource keeps different kinds from ever colliding.
 */
export function resourceKey(resource: MigratableResource): string {
  return `${resourceKeyOf(resource.group, resource.resource)}/${resource.uid}`;
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
}

/** A folder as the table needs it: a title to show and a parent to nest under. */
interface ListedFolder {
  title: string;
  parentUid?: string;
}

/** The rows of one kind, with whatever the UI knows about that kind. */
interface KindRows {
  group: string;
  resource: string;
  kind: string;
  info?: ResourceKindInfo;
  folderScoped: boolean;
  rows: ResourceListItem[];
}

/** Synthetic folder UID for a non-folder kind. Namespaced so it can't collide
 * with a real folder uid. */
function syntheticFolderUid(kind: KindRows): string {
  return `__migrate_${kind.resource}__`;
}

/**
 * Walks the parent chain of a folder and returns its ancestor titles, outermost
 * first and excluding the folder itself. Missing ancestors (a parent not present
 * in the listed folders) end the walk; a `seen` guard keeps a malformed cyclic
 * parent reference from looping forever.
 */
function ancestorTitles(uid: string, folderByUid: Map<string, ListedFolder>): string[] {
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
function collectContainers(rows: FolderRow[], folderByUid: Map<string, ListedFolder>): FolderRow[] {
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
 * Joins the listed resources into the per-folder table the UI renders.
 * Folder-scoped kinds nest under the folder that directly contains them (and
 * roll up at the root into a synthetic "General" row); non-folder kinds get one
 * synthetic folder row per kind. App-generated resources (e.g. the SLO app's
 * dashboards/folders) are dropped: the backend export skips them, so offering
 * them as selectable here would let a user pick resources that never actually
 * migrate. Folders with nothing to migrate are left out of `rows`, apart from
 * the ancestors of folders that do have something, returned as `containers`.
 */
function aggregate(
  folderByUid: Map<string, ListedFolder>,
  kinds: KindRows[]
): { rows: FolderRow[]; containers: FolderRow[] } {
  const directByFolder = new Map<string, MigratableResource[]>();
  const rootResources: MigratableResource[] = [];
  const syntheticRows: FolderRow[] = [];

  for (const kind of kinds) {
    const migratable = kind.rows.filter((row) => !isAppGeneratedResource(row.name));
    const toResource = (row: ResourceListItem): MigratableResource => ({
      uid: row.name,
      title: row.title || row.name,
      group: row.group,
      resource: row.resource,
      kind: kind.kind,
      info: kind.info,
    });

    if (!kind.folderScoped) {
      if (migratable.length > 0) {
        syntheticRows.push({
          uid: syntheticFolderUid(kind),
          title: kind.info?.pluralLabel() ?? kind.resource,
          path: [],
          resourceCount: migratable.length,
          directResources: migratable.map(toResource),
        });
      }
      continue;
    }

    for (const row of migratable) {
      const parentUid = readImmediateParent(row.folder);
      if (!parentUid) {
        rootResources.push(toResource(row));
        continue;
      }
      const existing = directByFolder.get(parentUid);
      if (existing) {
        existing.push(toResource(row));
      } else {
        directByFolder.set(parentUid, [toResource(row)]);
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
 * Groups the listed rows by kind and fills in what the namespace list does not carry: the
 * Kubernetes Kind of a kind the registry has no entry for, and, for a collection member, the group
 * that serves it rather than the one it is stored under. Both come from API discovery, which is
 * only consulted when some row needs it; reading a collection's members also drops the read-only
 * ones the index reports as unmanaged.
 */
async function groupByKind(rows: ResourceListItem[]): Promise<KindRows[]> {
  const byKind = new Map<string, KindRows>();
  for (const row of rows) {
    const key = resourceKeyOf(row.group, row.resource);
    let kind = byKind.get(key);
    if (!kind) {
      const info = getKindInfoByGroupResource(row.group, row.resource);
      kind = {
        group: row.group,
        resource: row.resource,
        kind: info?.kind ?? '',
        info,
        // With no registry entry to ask, a kind is folder-scoped if the index places any of its
        // resources in a folder.
        folderScoped: info?.folderScoped ?? false,
        rows: [],
      };
      byKind.set(key, kind);
    }
    kind.rows.push(row);
    if (!kind.info && readImmediateParent(row.folder)) {
      kind.folderScoped = true;
    }
  }

  const kinds = Array.from(byKind.values());
  const unknown = kinds.filter((kind) => !kind.kind);
  if (unknown.length > 0) {
    const names = await resolveKindNames(unknown);
    for (const kind of unknown) {
      kind.kind = names.get(resourceKeyOf(kind.group, kind.resource)) ?? '';
    }
  }

  for (const kind of kinds.filter((k) => k.info?.collectionGroup)) {
    const members = await resolveCollectionMembers(kind.group, kind.resource);
    kind.rows = kind.rows.flatMap((row) => {
      const member = members.get(row.name);
      return member?.readOnly ? [] : [{ ...row, group: member?.group ?? row.group }];
    });
  }

  return kinds;
}

/**
 * Reads the per-folder migrate table from the namespace resources endpoint. Two calls to the same
 * endpoint: the unmanaged rows are what can be migrated, and the folder listing is unfiltered
 * because a managed folder still has to render as the container of an unmanaged child.
 *
 * Which kinds are listed is the server's decision, so a newly provisionable kind shows up here
 * without a change to the UI.
 */
export function useMigrationData(): State & { refetch: () => void } {
  const dispatch = useDispatch();
  const [state, setState] = useState<State>({
    data: [],
    containers: [],
    isLoading: true,
    isError: false,
  });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const folderKind = resourceKindInfos.folder;
      try {
        const [folders, unmanaged] = await Promise.all([
          listNamespaceResources(dispatch, { group: folderKind.group, resource: folderKind.resource }),
          listNamespaceResources(dispatch, { managed: false }),
        ]);
        if (cancelled) {
          return;
        }

        const folderByUid = new Map<string, ListedFolder>(
          folders
            .filter((folder) => !isAppGeneratedResource(folder.name))
            .map((folder) => [
              folder.name,
              { title: folder.title || folder.name, parentUid: readImmediateParent(folder.folder) },
            ])
        );
        // Folders are the containers the other kinds nest under, never a migration target of their
        // own, so they are dropped from the selectable rows.
        const kinds = await groupByKind(unmanaged.filter((row) => row.resource !== folderKind.resource));
        if (cancelled) {
          return;
        }

        const { rows, containers } = aggregate(folderByUid, kinds);
        setState({ data: rows, containers, isLoading: false, isError: false });
      } catch {
        if (!cancelled) {
          setState({ data: [], containers: [], isLoading: false, isError: true });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadToken, dispatch]);

  // Refetch in the background — we don't flip back to the loading state, so a
  // post-migration refresh doesn't unmount the page (and the drawer that
  // triggered it); the rows just update once the new data lands.
  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { ...state, refetch };
}
