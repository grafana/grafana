import * as React from 'react';

import { Page } from 'app/core/components/Page/Page';
import { NewDataSource } from 'app/features/datasources/components/NewDataSource';

export function NewDataSourcePage() {
  return (
    <Page
      navId={'connections-datasources'}
      pageNav={{ text: 'Add data source', subTitle: 'Choose a data source type', active: true }}
    >
      <Page.Contents>
        <NewDataSource />
      </Page.Contents>
    </Page>
  );
}
