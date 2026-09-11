import { useCallback, useEffect, useMemo, useState } from 'react';

import { getMessageFromError } from 'app/core/utils/errors';
import { type DashboardViewItemWithUIItems, type DashboardsTreeItem } from 'app/features/browse-dashboards/types';
import { getAccessibleFolderTree, type AccessibleFolderTreeItem } from 'app/features/folders/api/accessibleFolderTree';

import { type UseFoldersQueryProps } from './useFoldersQuery';
import { getRootFolderItem } from './utils';

const collator = new Intl.Collator();

export function useFoldersQueryAccessible({
  isBrowsing,
  openFolders,
  permission = 'edit',
  rootFolderUID,
  rootFolderItem,
  enabled = true,
}: UseFoldersQueryProps & { enabled?: boolean }) {
  const [tree, setTree] = useState<AccessibleFolderTreeItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error>();

  useEffect(() => {
    if (!enabled || !isBrowsing) {
      return;
    }
    let active = true;
    setTree([]);
    setIsLoading(true);
    setError(undefined);
    getAccessibleFolderTree(permission)
      .then((items) => active && setTree(items))
      .catch((error) => active && setError(new Error(getMessageFromError(error))))
      .finally(() => active && setIsLoading(false));
    return () => {
      active = false;
    };
  }, [enabled, isBrowsing, permission]);

  const { items, emptyFolders } = useMemo(() => {
    if (!enabled || !isBrowsing) {
      return { items: [], emptyFolders: new Set<string>() };
    }

    const children = new Map<string | undefined, AccessibleFolderTreeItem[]>();
    for (const item of tree) {
      const parent = item.parent || undefined;
      children.set(parent, [...(children.get(parent) ?? []), item]);
    }
    for (const siblings of children.values()) {
      siblings.sort((a, b) => collator.compare(a.title, b.title) || collator.compare(a.name, b.name));
    }

    const empty = new Set<string>();
    const flatten = (
      parent: string | undefined,
      level: number
    ): Array<DashboardsTreeItem<DashboardViewItemWithUIItems>> =>
      (children.get(parent) ?? []).flatMap((folder) => {
        const isOpen = Boolean(openFolders[folder.name]);
        const childItems = children.get(folder.name) ?? [];
        if (childItems.length === 0) {
          empty.add(folder.name);
        }
        const row: DashboardsTreeItem = {
          isOpen,
          level,
          parentUID: folder.parent || undefined,
          item: {
            kind: 'folder',
            uid: folder.name,
            title: folder.title,
            parentUID: folder.parent || undefined,
            access: folder.access,
          },
        };
        return isOpen ? [row, ...flatten(folder.name, level + 1)] : [row];
      });

    return {
      items: [rootFolderItem || getRootFolderItem(), ...flatten(rootFolderUID, 1)],
      emptyFolders: empty,
    };
  }, [enabled, isBrowsing, openFolders, rootFolderUID, rootFolderItem, tree]);

  const requestNextPage = useCallback((_parentUID: string | undefined) => Promise.resolve(), []);
  return { items, emptyFolders, isLoading, error, requestNextPage };
}
