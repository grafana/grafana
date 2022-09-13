import React from 'react';

import { NavModel } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';

import { NewDataSource } from '../components/NewDataSource';
import { DATASOURCES_ROUTES } from '../constants';

const navModel = getNavModel();

export function NewDataSourcePage() {
  return (
    <Page navModel={navModel}>
      <Page.Contents>
        <NewDataSource />
      </Page.Contents>
    </Page>
  );
}

export function getNavModel(): NavModel {
  const main = {
    icon: 'database' as const,
    id: 'datasource-new',
    text: 'Add data source',
    href: DATASOURCES_ROUTES.New,
    subTitle: 'Choose a data source type',
  };

  return {
    main: main,
    node: main,
  };
}

export default NewDataSourcePage;
