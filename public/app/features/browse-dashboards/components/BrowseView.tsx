import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getFolderChildren } from 'app/features/search/service/folders';
import { DashboardViewItem } from 'app/features/search/types';

import { DashboardsTreeItem } from '../types';

import { DashboardsTree } from './DashboardsTree';

interface BrowseViewProps {
  height: number;
  width: number;
  folderUID: string | undefined;
}

export function BrowseView({ folderUID, width, height }: BrowseViewProps) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({ [folderUID ?? '$$root']: true });

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

  const flatTree = useMemo(
    () => createFlatTree(folderUID, childrenByUID, openFolders),
    [folderUID, childrenByUID, openFolders]
  );

  const handleFolderClick = useCallback((uid: string, folderIsOpen: boolean) => {
    if (folderIsOpen) {
      loadChildrenForUID(uid);
    }

    setOpenFolders((v) => ({ ...v, [uid]: folderIsOpen }));
  }, []);

  return <DashboardsTree items={flatTree} width={width} height={height} onFolderClick={handleFolderClick} />;
}

// Creates a flat list of items, with nested children indicated by its increasing level
function createFlatTree(
  rootFolderUID: string | undefined,
  childrenByUID: Record<string, DashboardViewItem[] | undefined>,
  openFolders: Record<string, boolean>,
  level = 0
): DashboardsTreeItem[] {
  function mapItem(item: DashboardViewItem, level: number): DashboardsTreeItem[] {
    const mappedChildren = createFlatTree(item.uid, childrenByUID, openFolders, level + 1);

    const isOpen = Boolean(openFolders[item.uid]);
    const emptyFolder = childrenByUID[item.uid]?.length === 0;
    if (isOpen && emptyFolder) {
      mappedChildren.push({ isOpen: false, level: level + 1, item: { kind: 'ui-empty-folder' } });
    }

    const thisItem = {
      item,
      level,
      isOpen,
    };

    return [thisItem, ...mappedChildren];
  }

  const folderKey = rootFolderUID ?? '$$root';
  const isOpen = Boolean(openFolders[folderKey]);
  const items = (isOpen && childrenByUID[folderKey]) || [];

  return items.flatMap((item) => mapItem(item, level));
}
