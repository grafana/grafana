import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList as List } from 'react-window';
import InfiniteLoader from 'react-window-infinite-loader';

import { Icon, IconButton, Link } from '@grafana/ui';
import { getFolderChildren } from 'app/features/search/service/folders';
import { DashboardViewItem } from 'app/features/search/types';

type NestedData = Record<string, DashboardViewItem[] | undefined>;

interface BrowseViewProps {
  folderUID: string | undefined;
}

interface FlatNestedTreeItem {
  item: DashboardViewItem;
  level: number;
  isOpen: boolean;
}

export function BrowseView({ folderUID }: BrowseViewProps) {
  const [openFolders, setOpenFolders] = useState<string[]>([]);

  const [nestedData, setNestedData] = useState<NestedData>({});

  // Note: entire implementation of this component must be replaced.
  // This is just to show proof of concept for fetching and showing the data

  useEffect(() => {
    function loadChildrenForUID(uid: string | undefined) {
      const folderKey = uid ?? '$$root';

      return getFolderChildren(uid, undefined, true).then((children) => {
        setNestedData((v) => ({ ...v, [folderKey]: children }));
      });
    }

    loadChildrenForUID(folderUID);
  }, [folderUID]);

  const flatTree = useMemo(() => {
    function mapItems(items: DashboardViewItem[], level = 0): FlatNestedTreeItem[] {
      return items.flatMap((item) => {
        const isOpen = openFolders.includes(item.uid);
        const rawChildren = (isOpen && nestedData[item.uid]) || [];
        const mappedChildren = mapItems(rawChildren, level + 1);

        const thisItem = {
          item,
          level,
          isOpen,
        };

        return [thisItem, ...mappedChildren];
      });
    }

    const items = nestedData[folderUID ?? '$$root'] ?? [];

    return mapItems(items);
  }, [openFolders, nestedData, folderUID]);

  const handleFolderClick = useCallback((uid: string, newState: boolean) => {
    if (newState) {
      getFolderChildren(uid).then((children) => {
        setNestedData((v) => ({ ...v, [uid]: children }));
      });
    }

    setOpenFolders((v) => {
      if (newState) {
        return [...v, uid];
      } else {
        return v.filter((v) => v !== uid);
      }
    });
  }, []);

  const virtualData = useMemo(() => {
    return {
      items: flatTree,
      onFolderClick: handleFolderClick,
    };
  }, [flatTree, handleFolderClick]);

  const onItemsRendered = useCallback((args) => {
    console.log('onItemsRendered', args);
  }, []);

  return (
    <div style={{ height: '100%', border: '1px solid grey' }}>
      <AutoSizer>
        {({ width, height }) => (
          <List
            onItemsRendered={onItemsRendered}
            height={height}
            width={width}
            itemCount={flatTree.length}
            itemData={virtualData}
            itemSize={35}
          >
            {Row}
          </List>
        )}
      </AutoSizer>
    </div>
  );
}

interface VirtualData {
  items: FlatNestedTreeItem[];
  onFolderClick: (uid: string, newOpenState: boolean) => void;
}

const Row = ({ index, style, data }: { index: number; style: React.CSSProperties; data: VirtualData }) => {
  const { item, isOpen, level } = data.items[index];

  return (
    <div style={{ paddingLeft: level * 16, ...style }}>
      <BrowseItem item={item} isOpen={isOpen} onFolderClick={data.onFolderClick} />
    </div>
  );
};

function BrowseItem({
  item,
  isOpen,
  onFolderClick,
}: {
  item: DashboardViewItem;
  isOpen?: boolean;
  onFolderClick: (uid: string, newOpenState: boolean) => void;
}) {
  return (
    <div>
      {item.kind === 'folder' ? (
        <IconButton onClick={() => onFolderClick(item.uid, !isOpen)} name={isOpen ? 'angle-down' : 'angle-right'} />
      ) : (
        <span style={{ paddingRight: 20 }} />
      )}
      <Icon name={item.kind === 'folder' ? (isOpen ? 'folder-open' : 'folder') : 'apps'} />{' '}
      <Link href={item.kind === 'folder' ? `/nested-dashboards/f/${item.uid}` : `/d/${item.uid}`}>{item.title}</Link>
    </div>
  );
}
