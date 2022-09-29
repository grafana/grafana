import React from 'react';

import { Page } from 'app/core/components/Page/Page';

import { DataSourcesList } from '../components/DataSourcesList';

export function DataSourcesListPage() {
  return (
    <Page navId="datasources">
      <Page.Contents>
        <DataSourcesList />
      </Page.Contents>
    </Page>
  );
}

export default DataSourcesListPage;
