import { PageLayoutType } from '@grafana/data';

import { Page } from '../Page/Page';

import { EntityNotFound } from './EntityNotFound';

export function PageNotFound() {
  return (
    <Page navId="home" layout={PageLayoutType.Canvas} pageNav={{ text: 'Страница не найдена' }}>
      <EntityNotFound entity="Page" />
    </Page>
  );
}
