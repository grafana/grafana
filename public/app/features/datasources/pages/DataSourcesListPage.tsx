import React from 'react';

import { Page } from 'app/core/components/Page/Page';
import { ConnectionsRedirectNotice } from 'app/features/connections/components/ConnectionsRedirectNotice';
import { StoreState, useSelector } from 'app/types';

import { DataSourceAddButton } from '../components/DataSourceAddButton';
import { DataSourcesList } from '../components/DataSourcesList';
import { getDataSourcesCount } from '../state';

export function DataSourcesListPage() {
  const dataSourcesCount = useSelector(({ dataSources }: StoreState) => getDataSourcesCount(dataSources));

  const actions = dataSourcesCount > 0 ? <DataSourceAddButton /> : undefined;
  return (
    <Page navId="datasources" actions={actions}>
      <Page.Contents>
        <ConnectionsRedirectNotice />
        <DataSourcesList />
      </Page.Contents>
    </Page>
  );
}

export default DataSourcesListPage;
