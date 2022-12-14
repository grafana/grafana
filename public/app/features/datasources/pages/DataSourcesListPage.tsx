import React from 'react';

import { config } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';

import { DataSourceAddButton } from '../components/DataSourceAddButton';
import { DataSourcesList } from '../components/DataSourcesList';

export function DataSourcesListPage() {
  const actions = config.featureToggles.topnav ? DataSourceAddButton() : undefined;
  return (
    <Page navId="datasources" actions={actions}>
      <Page.Contents>
        <DataSourcesList />
      </Page.Contents>
    </Page>
  );
}

export default DataSourcesListPage;
