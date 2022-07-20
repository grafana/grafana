import React from 'react';

import { NavModel } from '@grafana/data';
import { Page } from 'app/core/components/Page/Page';

import { NewDataSource } from '../components/NewDataSource';

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
    icon: 'database',
    id: 'datasource-new',
    text: 'Add data source',
    href: 'datasources/new',
    subTitle: 'Choose a data source type',
  };

  return {
    main: main,
    node: main,
  };
}

export default NewDataSourcePage;
