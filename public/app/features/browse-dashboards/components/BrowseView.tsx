import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getFolderChildren } from 'app/features/search/service/folders';
import { DashboardViewItem } from 'app/features/search/types';

import { DashboardsTree, DashboardsTreeItem } from './DashboardsTree';

interface BrowseViewProps {
  height: number;
  width: number;
  folderUID: string | undefined;
}

export function BrowseView({ folderUID, width, height }: BrowseViewProps) {
  const [openFolders, setOpenFolders] = useState<string[]>([]);

  // Rather than storing an actual tree structure (requiring traversing the tree to update children), instead
  // we keep track of children for each UID and then later combine them in the format required to display them
  const [childrenByUID, setChildrenByUID] = useState<Record<string, DashboardViewItem[] | undefined>>({});

  async function loadChildrenForUID(uid: string | undefined) {
    const folderKey = uid ?? '$$root';

    const childItems = await getFolderChildren(uid, undefined, true);
    setChildrenByUID((v) => ({ ...v, [folderKey]: childItems }));
  }

  useEffect(() => {
    loadChildrenForUID(folderUID);
  }, [folderUID]);

  const flatTree = useMemo(() => {
    function mapItem(item: DashboardViewItem, level: number): DashboardsTreeItem[] {
      const isOpen = openFolders.includes(item.uid);
      const rawChildren = isOpen && childrenByUID[item.uid];
      const mappedChildren = mapItems(rawChildren || [], level + 1);

      const emptyFolder = rawChildren ? rawChildren.length === 0 : null;

      if (isOpen && emptyFolder) {
        mappedChildren.push({ isOpen: false, level: level + 2, item: { kind: 'ui-empty-folder' } });
      }

      const thisItem = {
        item,
        level,
        isOpen,
      };

      return [thisItem, ...mappedChildren];
    }

    function mapItems(items: DashboardViewItem[], level: number): DashboardsTreeItem[] {
      return items.flatMap((item) => mapItem(item, level));
    }

    const items = childrenByUID[folderUID ?? '$$root'] ?? [];
    const mappedItems = mapItems(items, 0);
    return mappedItems;
  }, [openFolders, childrenByUID, folderUID]);

  const handleFolderClick = useCallback((uid: string, folderIsOpen: boolean) => {
    if (folderIsOpen) {
      loadChildrenForUID(uid);
    }

    setOpenFolders((v) => {
      if (folderIsOpen) {
        return [...v, uid];
      } else {
        return v.filter((v) => v !== uid);
      }
    });
  }, []);

  return <DashboardsTree items={flatTree} width={width} height={height} onFolderClick={handleFolderClick} />;
}
