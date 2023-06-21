import React from 'react';

import { PageLayoutType } from '@grafana/data';

import { Page } from '../Page/Page';

import { EntityNotFound } from './EntityNotFound';

export function PageNotFound() {
  return (
    <Page navId="home" layout={PageLayoutType.Canvas} pageNav={{ text: 'Page not found' }}>
      <EntityNotFound entity="Page" />
    </Page>
  );
}
