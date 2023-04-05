import React, { useCallback, useEffect, useState } from 'react';

import { Icon } from '@grafana/ui';
import { getFolderChildren } from 'app/features/search/service/folders';
import { DashboardViewItem } from 'app/features/search/types';

type NestedData = Record<string, DashboardViewItem[] | undefined>;

interface BrowseDashboardsViewProps {
  folderUID: string | undefined;
}

export default function BrowseDashboardsView({ folderUID }: BrowseDashboardsViewProps) {
  const [nestedData, setNestedData] = useState<NestedData>({});

  useEffect(() => {
    const folderKey = folderUID ?? '$$root';

    getFolderChildren(folderUID).then((children) => {
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
      <div onClick={() => item.kind === 'folder' && onFolderClick(item.uid)}>
        <Icon name={item.kind === 'folder' ? (childItems ? 'folder-open' : 'folder') : 'apps'} /> {item.title}
      </div>

      {childItems && (
        <ul style={{ marginLeft: 16 }}>
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
