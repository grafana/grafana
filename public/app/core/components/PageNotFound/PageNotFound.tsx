import { PageLayoutType } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Page } from '../Page/Page';

import { EntityNotFound } from './EntityNotFound';

export function PageNotFound() {
  return (
    <Page
      navId="home"
      layout={PageLayoutType.Canvas}
      pageNav={{ text: t('entity-not-found.title', '{{entity}} not found', { entity: 'Page' }) }}
    >
      <EntityNotFound entity="Page" />
    </Page>
  );
}
