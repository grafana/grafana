import React from 'react';

import { Page } from 'app/core/components/Page/Page';

import { PublicDashboardListTable } from './components/PublicDashboardListTable';

export const ListPublicDashboardPage = ({}) => {
  return (
    <Page navId="dashboards/public">
      <Page.Contents>
        <PublicDashboardListTable />
      </Page.Contents>
    </Page>
  );
};

export default ListPublicDashboardPage;
