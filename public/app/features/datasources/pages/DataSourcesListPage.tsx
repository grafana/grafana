import React from 'react';

import { config } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import {
  ConnectionsRedirectNotice,
  DestinationPage,
} from 'app/features/connections/components/ConnectionsRedirectNotice';
import { StoreState, useSelector } from 'app/types';

import { DataSourceAddButton } from '../components/DataSourceAddButton';
import { DataSourcesList } from '../components/DataSourcesList';
import { getDataSourcesCount } from '../state';

export function DataSourcesListPage() {
  const dataSourcesCount = useSelector(({ dataSources }: StoreState) => getDataSourcesCount(dataSources));

  const actions = config.featureToggles.topnav && dataSourcesCount > 0 ? <DataSourceAddButton /> : undefined;
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
