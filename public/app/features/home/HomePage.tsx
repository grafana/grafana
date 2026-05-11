import { PageLayoutType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Page } from 'app/core/components/Page/Page';

import useHomeGreeting from './useHomeGreeting';

export default function HomePage() {
  const greeting = useHomeGreeting();

  return (
    <Page
      navId="home"
      pageNav={{
        text: greeting,
        subTitle: t('home.home-page.placeholder', 'Welcome to Grafana.'),
        hideFromBreadcrumbs: true,
      }}
      layout={PageLayoutType.Home}
    >
      <Page.Contents>
        <></>
      </Page.Contents>
    </Page>
  );
}
