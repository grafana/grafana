import React, { memo } from 'react';

import { Page } from 'app/core/components/Page/Page';
import BrowseDashboardsPage from 'app/features/browse-dashboards/components/BrowseDashboardsPage';

import { GrafanaRouteComponentProps } from '../../../core/navigation/types';

export interface NestedDashboardsListPageRouteParams {
  uid?: string;
  slug?: string;
}

interface Props extends GrafanaRouteComponentProps<NestedDashboardsListPageRouteParams> {}

export const NestedDashboardsListPage = memo(({ match, location }: Props) => {
  const { uid, slug } = match.params;

  return (
    <Page navId="dashboards/browse">
      <Page.Contents>
        <pre>{JSON.stringify({ uid, slug })}</pre>
        <BrowseDashboardsPage />
      </Page.Contents>
    </Page>
  );
});

NestedDashboardsListPage.displayName = 'NestedDashboardsListPage';

export default NestedDashboardsListPage;
