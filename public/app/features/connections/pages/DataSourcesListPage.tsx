import * as React from 'react';

import { Page } from 'app/core/components/Page/Page';
import { DataSourcesList } from 'app/features/datasources/components/DataSourcesList';

export function DataSourcesListPage() {
  return (
    <Page navId={'connections-your-connections-datasources'}>
      <Page.Contents>
        <DataSourcesList />
      </Page.Contents>
    </Page>
  );
}
