import React from 'react';

import { config } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import {
  ConnectionsRedirectNotice,
  DestinationPage,
} from 'app/features/connections/components/ConnectionsRedirectNotice';

import { DataSourceAddButton } from '../components/DataSourceAddButton';
import { DataSourcesList } from '../components/DataSourcesList';

export function DataSourcesListPage() {
  const actions = config.featureToggles.topnav ? <DataSourceAddButton /> : undefined;
  return (
    <Page navId="datasources" actions={actions}>
      <Page.Contents>
        {config.featureToggles.dataConnectionsConsole && (
          <ConnectionsRedirectNotice destinationPage={DestinationPage.dataSources} />
        )}
        <DataSourcesList />
      </Page.Contents>
    </Page>
  );
}

export default DataSourcesListPage;
