import React from 'react';

import { Page } from 'app/core/components/Page/Page';

import { PublicDashboardListTable } from './components/PublicDashboardListTable/PublicDashboardListTable';

export const ListPublicDashboardPage = ({}) => {
  return (
    <Page navId="dashboards/public">
      <PublicDashboardListTable />
    </Page>
  );
};

export default ListPublicDashboardPage;
