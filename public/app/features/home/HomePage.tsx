import { PageLayoutType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Page } from 'app/core/components/Page/Page';

export default function HomePage() {
  return (
    <Page
      navId="home"
      pageNav={{ text: t('home.home-page.placeholder', 'Welcome to Grafana'), hideFromBreadcrumbs: true }}
      layout={PageLayoutType.Home}
    >
      <Page.Contents>
        <></>
      </Page.Contents>
    </Page>
  );
}
