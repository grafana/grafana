import * as React from 'react';

import { Page } from 'app/core/components/Page/Page';

export function DataSourceDetailsPage() {
  return (
    <Page
      navId={'connections-connect-data'}
      pageNav={{
        text: 'Datasource details',
        subTitle: 'This is going to be the details page for a datasource',
        active: true,
      }}
    >
      <Page.Contents>Data Source Details (no exposed component from plugins yet)</Page.Contents>
    </Page>
  );
}
