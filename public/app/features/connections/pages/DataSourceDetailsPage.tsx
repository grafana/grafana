import * as React from 'react';

import { Page } from 'app/core/components/Page/Page';

export function DataSourceDetailsPage() {
  return (
    // TODO: make sure to use the correct nav id here (breadcrumbs?)
    // Also figure out how we can make the page title and the breadcumbs dynamic (using the plugins name) - only with navModel?
    <Page navId={'connections-connect-data'}>
      <Page.Contents>Data Source Details (no exposed component from plugins yet)</Page.Contents>
    </Page>
  );
}
