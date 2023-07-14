import * as React from 'react';

import { Page } from 'app/core/components/Page/Page';
import { NewDataSource } from 'app/features/connections/components/NewDataSource';

export function NewDataSourcePage() {
  return (
    <Page
      navId={'connections-datasources'}
      pageNav={{ text: 'Add data source', subTitle: 'Choose a data source type', active: true, icon: 'database' }}
    >
      <Page.Contents>
        <NewDataSource />
      </Page.Contents>
    </Page>
  );
}
