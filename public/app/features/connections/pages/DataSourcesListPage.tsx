import * as React from 'react';

import { config } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { DataSourceAddButton } from 'app/features/datasources/components/DataSourceAddButton';
import { DataSourcesList } from 'app/features/datasources/components/DataSourcesList';

export function DataSourcesListPage() {
  const actions = config.featureToggles.topnav ? DataSourceAddButton() : undefined;
  return (
    <Page navId={'connections-your-connections-datasources'} actions={actions}>
      <Page.Contents>
        <DataSourcesList />
      </Page.Contents>
    </Page>
  );
}
