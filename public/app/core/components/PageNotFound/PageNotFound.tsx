import { PageLayoutType } from '@grafana/data';
import { t } from '@grafana/i18n';

import { Page } from '../Page/Page';

import { EntityNotFound } from './EntityNotFound';

export function PageNotFound() {
  return (
<<<<<<< HEAD
    <Page navId="home" layout={PageLayoutType.Canvas} pageNav={{ text: 'Страница не найдена' }}>
=======
    <Page
      navId="home"
      layout={PageLayoutType.Canvas}
      pageNav={{ text: t('entity-not-found.title', '{{entity}} not found', { entity: 'Page' }) }}
    >
>>>>>>> fd443127ae3147c35dcab1af745f7481cb2711bc
      <EntityNotFound entity="Page" />
    </Page>
  );
}
