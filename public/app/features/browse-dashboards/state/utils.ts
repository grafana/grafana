import { ManagerKind } from 'app/features/apiserver/types';
import { GENERAL_FOLDER_UID, isRootFolderUID } from 'app/features/search/constants';
import { type DashboardViewItem, type DashboardViewItemKind } from 'app/features/search/types';

import { type BrowseDashboardsState } from '../types';

/** The key a load addresses: `undefined` for the root, whichever sentinel the caller used. */
export function collectionKeyOf(parentUID: string | undefined): string | undefined {
  return isRootFolderUID(parentUID) ? undefined : parentUID;
}

/** Current generation of a collection; a load compares the value it started with against this. */
export function collectionGeneration(state: BrowseDashboardsState, collectionKey: string | undefined): number {
  return state.collectionGenerations?.[collectionKey ?? GENERAL_FOLDER_UID] ?? 0;
}

/**
 * Finds the item with the given kind and uid in either the root items or childrenByUID. UIDs are unique per kind
 * only, so callers must say which kind they want.
 */
export function findItem(
  rootItems: DashboardViewItem[],
  childrenByUID: BrowseDashboardsState['childrenByParentUID'],
  kind: DashboardViewItemKind,
  uid: string
): DashboardViewItem | undefined {
  for (const item of rootItems) {
    if (item.kind === kind && item.uid === uid) {
      return item;
    }
  }

  for (const parentUID in childrenByUID) {
    const children = childrenByUID[parentUID];
    if (!children) {
      continue;
    }

    for (const child of children.items) {
      if (child.kind === kind && child.uid === uid) {
        return child;
      }
    }
  }

  return undefined;
}

/**
 * Yields an item's loaded ancestor folders, nearest first, stopping at the first one not in state.
 */
export function* ancestorsOf(
  item: Pick<DashboardViewItem, 'parentUID'>,
  rootItems: DashboardViewItem[],
  childrenByUID: BrowseDashboardsState['childrenByParentUID']
): Generator<DashboardViewItem> {
  let parentUID = item.parentUID;
  while (parentUID) {
    const parent = findItem(rootItems, childrenByUID, 'folder', parentUID);
    if (!parent) {
      return;
    }
    yield parent;
    parentUID = parent.parentUID;
  }
}

/** A repository whose pull completed, with how it owns resources (`spec.sync.target`). */
export interface PulledRepository {
  name: string;
  target: 'instance' | 'folder' | 'folderless';
}

/** The folder in view and the repository that owns it, if any. Its own item is not in the tree. */
export interface ViewedFolder {
  folderUID: string | undefined;
  repository: string | undefined;
}

export interface RepositoryRefreshPlan {
  /** On screen: kept and refetched in place; a load still in flight for one is obsolete. */
  refetch: Array<string | undefined>;
  /** Off screen: dropped, reload when opened or visited next. */
  evict: Array<string | undefined>;
}

/**
 * True when the repository owns the item. An item managed through the repository feature without
 * a manager id (older API shape) cannot be told apart and counts as owned, so a stale listing is
 * never kept by mistake.
 */
export function isOwnedByRepository(
  item: Pick<DashboardViewItem, 'managedBy' | 'managerId'>,
  repository: PulledRepository
): boolean {
  if (repository.target === 'instance') {
    return true;
  }
  return item.managerId === repository.name || (item.managerId === undefined && item.managedBy === ManagerKind.Repo);
}

/**
 * The collections a pull of `repository` may have changed, split into the ones on screen and the
 * rest. An `instance` repository owns the whole tree. A `folder` one owns the folder named after it
 * and the folders inside, which carry its manager id; the root listing cannot change. A
 * `folderless` one owns top-level items too, so the root is in scope as well. On screen are the
 * collection in view and, at the root, the repository's open folder; those count even before
 * their first page has landed, since that page may predate the pull.
 */
export function planRepositoryRefresh(
  state: BrowseDashboardsState,
  repository: PulledRepository,
  viewed: ViewedFolder
): RepositoryRefreshPlan {
  const { rootItems, childrenByParentUID, openFolders } = state;
  // Only a `folder` repository has a folder of its own; the root cannot change under it.
  const ownFolder = repository.target === 'folder' ? repository.name : undefined;
  const ownsViewed = repository.target === 'instance' || viewed.repository === repository.name;
  const inScope = new Set<string | undefined>();

  if (!ownFolder) {
    inScope.add(undefined);
  }
  if (viewed.folderUID !== undefined && ownsViewed) {
    inScope.add(viewed.folderUID);
  }
  if (ownFolder !== undefined && openFolders[ownFolder]) {
    inScope.add(ownFolder);
  }

  for (const [uid, collection] of Object.entries(childrenByParentUID)) {
    if (!collection || inScope.has(uid) || uid === viewed.folderUID) {
      continue;
    }
    if (uid === ownFolder || repository.target === 'instance') {
      inScope.add(uid);
    } else {
      // A folder whose own item is not loaded is not on screen either, so dropping it costs nothing.
      const folder = findItem(rootItems?.items ?? [], childrenByParentUID, 'folder', uid);
      if (!folder || isOwnedByRepository(folder, repository)) {
        inScope.add(uid);
      }
    }
  }

  const onScreen = (uid: string | undefined) =>
    uid === viewed.folderUID ||
    (ownFolder !== undefined && uid === ownFolder && viewed.folderUID === undefined && openFolders[ownFolder]);
  const keys = Array.from(inScope);

  return { refetch: keys.filter(onScreen), evict: keys.filter((uid) => !onScreen(uid)) };
}

export function getPaginationPlaceholders(amount: number, parentUID: string | undefined, level: number) {
  return new Array(amount).fill(null).map((_, index) => {
    return {
      parentUID,
      level,
      isOpen: false,
      item: {
        kind: 'ui' as const,
        uiKind: 'pagination-placeholder' as const,
        uid: `${parentUID}-pagination-${index}`,
      },
    };
  });
}
