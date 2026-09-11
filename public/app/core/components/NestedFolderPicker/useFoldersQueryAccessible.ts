import { useCallback, useEffect, useMemo, useState } from 'react';

import { getMessageFromError } from 'app/core/utils/errors';
import { type DashboardViewItemWithUIItems, type DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import {
  buildFolderNavigationIndex,
  getFolderNavigationTree,
  type FolderNavigationItem,
} from 'app/features/folders/api/accessibleFolderTree';

import { type UseFoldersQueryProps } from './useFoldersQuery';
import { getRootFolderItem } from './utils';

export function useFoldersQueryAccessible({
  isBrowsing,
  openFolders,
  purpose = 'folder-edit',
  rootFolderUID,
  rootFolderItem,
}: UseFoldersQueryProps) {
  const [tree, setTree] = useState<FolderNavigationItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    if (!isBrowsing) {
      return;
    }
    let active = true;
    setTree([]);
    setIsLoading(true);
    setError(undefined);
    getFolderNavigationTree(purpose)
      .then((items) => active && setTree(items))
      .catch((error) => active && setError(new Error(getMessageFromError(error))))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [isBrowsing, purpose]);

  const { items, emptyFolders } = useMemo(() => {
    if (!isBrowsing) {
      return { items: [], emptyFolders: new Set<string>() };
    }

    const { childrenByParent: children } = buildFolderNavigationIndex(tree);

    const empty = new Set<string>();
    const flatten = (
      parent: string | undefined,
      level: number
    ): Array<DashboardsTreeItem<DashboardViewItemWithUIItems>> =>
      (children.get(parent) ?? []).flatMap((folder) => {
        const isOpen = Boolean(openFolders[folder.uid]);
        const childItems = children.get(folder.uid) ?? [];
        if (childItems.length === 0) {
          empty.add(folder.uid);
        }
        const row: DashboardsTreeItem = {
          isOpen,
          level,
          parentUID: folder.navigationParentUid || undefined,
          item: {
            kind: 'folder',
            uid: folder.uid,
            title: folder.title,
            parentUID: folder.navigationParentUid || undefined,
            access: folder.access,
            selectable: folder.selectable,
            navigationKind: folder.kind,
          },
        };
        return isOpen ? [row, ...flatten(folder.uid, level + 1)] : [row];
      });

    return {
      items: [rootFolderItem || getRootFolderItem(), ...flatten(rootFolderUID, 1)],
      emptyFolders: empty,
    };
  }, [isBrowsing, openFolders, rootFolderUID, rootFolderItem, tree]);

  const requestNextPage = useCallback((_parentUID: string | undefined) => Promise.resolve(), []);
  return { items, emptyFolders, isLoading, error, requestNextPage };
}
