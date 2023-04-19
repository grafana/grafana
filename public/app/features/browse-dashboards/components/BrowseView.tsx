import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { getFolderChildren } from 'app/features/search/service/folders';
import { DashboardViewItem, DashboardViewItemKind } from 'app/features/search/types';

import { DashboardsTreeItem } from '../types';

import { DashboardsTree } from './DashboardsTree';

interface BrowseViewProps {
  height: number;
  width: number;
  folderUID: string | undefined;
}

export function BrowseView({ folderUID, width, height }: BrowseViewProps) {
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({ [folderUID ?? '$$root']: true });

  const [selectedItems, setSelectedItems] = useState<
    Record<DashboardViewItemKind, Record<string, boolean | undefined>>
  >({
    folder: {},
    dashboard: {},
    panel: {},
  });

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

  const handleFolderClick = useCallback((uid: string, newState: boolean) => {
    if (newState) {
      loadChildrenForUID(uid);
    }

    setOpenFolders((old) => ({ ...old, [uid]: newState }));
  }, []);

  const handleItemSelectionChange = useCallback((kind: DashboardViewItemKind, uid: string, newState: boolean) => {
    console.log('setting', kind, uid, 'selection to', newState);
    setSelectedItems((old) => ({ ...old, [kind]: { ...old[kind], [uid]: newState } }));
  }, []);

  return (
    <DashboardsTree
      items={flatTree}
      width={width}
      height={height}
      selectedItems={selectedItems}
      onFolderClick={handleFolderClick}
      onItemSelectionChange={handleItemSelectionChange}
    />
  );
}

// Creates a flat list of items, with nested children indicated by its increasing level
function createFlatTree(
  rootFolderUID: string | undefined,
  childrenByUID: Record<string, DashboardViewItem[] | undefined>,
  openFolders: Record<string, boolean>,
  level = 0
): DashboardsTreeItem[] {
  function mapItem(item: DashboardViewItem, parentUID: string | undefined, level: number): DashboardsTreeItem[] {
    const mappedChildren = createFlatTree(item.uid, childrenByUID, openFolders, level + 1);

    const isOpen = Boolean(openFolders[item.uid]);
    const emptyFolder = childrenByUID[item.uid]?.length === 0;
    if (isOpen && emptyFolder) {
      mappedChildren.push({ isOpen: false, level: level + 1, item: { kind: 'ui-empty-folder' } });
    }

    const thisItem = {
      item,
      parentUID,
      level,
      isOpen,
    };

    return [thisItem, ...mappedChildren];
  }

  const folderKey = rootFolderUID ?? '$$root';
  const isOpen = Boolean(openFolders[folderKey]);
  const items = (isOpen && childrenByUID[folderKey]) || [];

  return items.flatMap((item) => mapItem(item, rootFolderUID, level));
}
