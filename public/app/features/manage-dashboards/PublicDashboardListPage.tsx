import React from 'react';

import { Page } from 'app/core/components/Page/Page';

import { ListPublicDashboardTable } from './components/PublicDashboardListTable';

export const ListPublicDashboardPage = ({}) => {
  return (
    <Page navId="dashboards/public">
      <Page.Contents>
        <ListPublicDashboardTable />
      </Page.Contents>
    </Page>
  );
};

export default ListPublicDashboardPage;
