import * as React from 'react';

import { config } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { DataSourceAddButton } from 'app/features/datasources/components/DataSourceAddButton';
import { DataSourcesList } from 'app/features/datasources/components/DataSourcesList';
import { getDataSourcesCount } from 'app/features/datasources/state';
import { StoreState, useSelector } from 'app/types';

export function DataSourcesListPage() {
  const dataSourcesCount = useSelector(({ dataSources }: StoreState) => getDataSourcesCount(dataSources));

  const actions = config.featureToggles.topnav && dataSourcesCount > 0 ? <DataSourceAddButton /> : undefined;
  return (
    <Page navId={'connections-your-connections-datasources'} actions={actions}>
      <Page.Contents>
        <DataSourcesList />
      </Page.Contents>
    </Page>
  );
}
