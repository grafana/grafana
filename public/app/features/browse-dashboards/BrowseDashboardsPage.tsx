import React, { memo } from 'react';

import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';

import { skipToken, useGetFolderQuery } from './api/browseDashboardsAPI';
import BrowseActions from './components/BrowseActions';
import NestedDashboardsList from './components/NestedDashboardsList';

export interface NestedDashboardsListPageRouteParams {
  uid?: string;
  slug?: string;
}

interface Props extends GrafanaRouteComponentProps<NestedDashboardsListPageRouteParams> {}

// New Browse/Manage/Search Dashboards views for nested folders

export const NestedDashboardsListPage = memo(({ match, location }: Props) => {
  const { uid: folderUID } = match.params;
  // TypeScript is also happy that the query will only ever be called with a `number` now
  const { data } = useGetFolderQuery(folderUID ?? skipToken);

  return (
    <Page navId="dashboards/browse">
      <Page.Contents>
        <BrowseActions />

        <NestedDashboardsList />

        <pre>{JSON.stringify(data, null, 2)}</pre>
      </Page.Contents>
    </Page>
  );
});

NestedDashboardsListPage.displayName = 'NestedDashboardsListPage';

export default NestedDashboardsListPage;
