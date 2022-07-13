import React from 'react';
import { useSelector } from 'react-redux';

import { Page } from 'app/core/components/Page/Page';
import { getNavModel } from 'app/core/selectors/navModel';
import { StoreState } from 'app/types';

import { DataSourcesList } from '../components/DataSourcesList';

export function DataSourcesListPage(): React.ReactElement {
  const navModel = useSelector(({ navIndex }: StoreState) => getNavModel(navIndex, 'datasources'));

  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <DataSourcesList />
      </Page.Contents>
    </Page>
  );
}

export default DataSourcesListPage;
