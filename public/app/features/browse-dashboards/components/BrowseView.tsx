import React, { useCallback, useEffect, useState } from 'react';

import { Icon, IconButton, Link } from '@grafana/ui';
import { getFolderChildren } from 'app/features/search/service/folders';
import { DashboardViewItem } from 'app/features/search/types';

type NestedData = Record<string, DashboardViewItem[] | undefined>;

interface BrowseDashboardsViewProps {
  folderUID: string | undefined;
}

export default function BrowseDashboardsView({ folderUID }: BrowseDashboardsViewProps) {
  const [nestedData, setNestedData] = useState<NestedData>({});

  // Note: entire implementation of this component must be replaced.
  // This is just to show proof of concept for fetching and showing the data

  useEffect(() => {
    const folderKey = folderUID ?? '$$root';

    getFolderChildren(folderUID, undefined, true).then((children) => {
      setNestedData((v) => ({ ...v, [folderKey]: children }));
    });
  }, [folderUID]);

  const items = nestedData[folderUID ?? '$$root'] ?? [];

  const handleNodeClick = useCallback(
    (uid: string) => {
      if (nestedData[uid]) {
        setNestedData((v) => ({ ...v, [uid]: undefined }));
        return;
      }

      getFolderChildren(uid).then((children) => {
        setNestedData((v) => ({ ...v, [uid]: children }));
      });
    },
    [nestedData]
  );

  return (
    <div>
      <p>Browse view</p>

      <ul style={{ marginLeft: 16 }}>
        {items.map((item) => {
          return (
            <li key={item.uid}>
              <BrowseItem item={item} nestedData={nestedData} onFolderClick={handleNodeClick} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function BrowseItem({
  item,
  nestedData,
  onFolderClick,
}: {
  item: DashboardViewItem;
  nestedData: NestedData;
  onFolderClick: (uid: string) => void;
}) {
  const childItems = nestedData[item.uid];

  return (
    <>
      <div>
        {item.kind === 'folder' ? (
          <IconButton onClick={() => onFolderClick(item.uid)} name={childItems ? 'angle-down' : 'angle-right'} />
        ) : (
          <span style={{ paddingRight: 20 }} />
        )}
        <Icon name={item.kind === 'folder' ? (childItems ? 'folder-open' : 'folder') : 'apps'} />{' '}
        <Link href={item.kind === 'folder' ? `/nested-dashboards/f/${item.uid}` : `/d/${item.uid}`}>{item.title}</Link>
      </div>

      {childItems && (
        <ul style={{ marginLeft: 16 }}>
          {childItems.length === 0 && (
            <li>
              <em>Empty folder</em>
            </li>
          )}
          {childItems.map((childItem) => {
            return (
              <li key={childItem.uid}>
                <BrowseItem item={childItem} nestedData={nestedData} onFolderClick={onFolderClick} />{' '}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
