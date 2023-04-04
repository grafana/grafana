import React, { memo, useCallback, useEffect, useState } from 'react';

import { Icon } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { getFolderChildren } from '../search/service/folders';
import { DashboardViewItem } from '../search/types';

import { skipToken, useGetFolderQuery } from './api/browseDashboardsAPI';
import BrowseActions from './components/BrowseActions';
import NestedDashboardsList from './components/NestedDashboardsList';

export interface BrowseDashboardsPageRouteParams {
  uid?: string;
  slug?: string;
}

interface Props extends GrafanaRouteComponentProps<BrowseDashboardsPageRouteParams> {}

// New Browse/Manage/Search Dashboards views for nested folders

type NestedData = Record<string, DashboardViewItem[] | undefined>;

export const BrowseDashboardsPage = memo(({ match, location }: Props) => {
  const { uid: folderUID } = match.params;

  const { data } = useGetFolderQuery(folderUID ?? skipToken);

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
    <Page navId="dashboards/browse">
      <Page.Contents>
        <BrowseActions />

        <NestedDashboardsList />

        <pre>{JSON.stringify(data, null, 2)}</pre>

        <ul style={{ marginLeft: 16 }}>
          {items.map((item) => {
            return (
              <li key={item.uid}>
                <BrowseItem item={item} nestedData={nestedData} onFolderClick={handleNodeClick} />
              </li>
            );
          })}
        </ul>
      </Page.Contents>
    </Page>
  );
});

BrowseDashboardsPage.displayName = 'BrowseDashboardsPage';

export default BrowseDashboardsPage;

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
