import React from 'react';

import { Page } from 'app/core/components/Page/Page';

import { SnapshotListTable } from './components/SnapshotListTable';

export const SnapshotListPage = ({}) => {
  return (
    <Page navId="dashboards/snapshots">
      <Page.Contents>
        <SnapshotListTable />
      </Page.Contents>
    </Page>
  );
};

export default SnapshotListPage;
