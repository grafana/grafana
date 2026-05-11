import { Trans } from '@grafana/i18n';
import { Page } from 'app/core/components/Page/Page';

export default function HomePage() {
  return (
    <Page navId="home">
      <Page.Contents>
        <Trans i18nKey="home.home-page.placeholder">Welcome to Grafana</Trans>
      </Page.Contents>
    </Page>
  );
}
