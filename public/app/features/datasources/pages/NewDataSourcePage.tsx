import React from 'react';

import { NavModelItem } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';

import { NewDataSource } from '../components/NewDataSource';
import { DATASOURCES_ROUTES } from '../constants';

export function NewDataSourcePage() {
  const pageNav: NavModelItem = {
    icon: 'database',
    id: 'datasource-new',
    text: 'Add data source',
    url: DATASOURCES_ROUTES.New,
    subTitle: 'Choose a data source type',
  };

  return (
    <Page navId="datasources" pageNav={pageNav}>
      <Page.Contents>
        <NewDataSource />
      </Page.Contents>
    </Page>
  );
}

export default NewDataSourcePage;
