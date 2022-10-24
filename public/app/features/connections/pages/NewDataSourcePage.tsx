import * as React from 'react';

import { Page } from 'app/core/components/Page/Page';
import { NewDataSource } from 'app/features/datasources/components/NewDataSource';

export function NewDataSourcePage() {
  // TODO: make sure to use the correct nav id here (breadcrumbs?)
  // Also figure out how we can make the page title and the breadcumbs dynamic (using the plugins name) - only with navModel?
  return (
    <Page navId={'connections-your-connections-datasources'}>
      <Page.Contents>
        <NewDataSource />
      </Page.Contents>
    </Page>
  );
}
