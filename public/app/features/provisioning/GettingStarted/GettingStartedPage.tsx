import { GrafanaEdition } from '@grafana/data/internal';
import { Trans, t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Alert, Stack, Text, TextLink } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import GettingStarted from './GettingStarted';

export default function GettingStartedPage() {
  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: t('provisioning.getting-started-page.header', 'Provisioning'),
        subTitle: t(
          'provisioning.getting-started-page.subtitle-provisioning-feature',
          'View and manage your provisioning connections'
        ),
      }}
    >
      <Page.Contents>
        <Stack direction="column" gap={3}>
          <Banner />
          <GettingStarted />
        </Stack>
      </Page.Contents>
    </Page>
  );
}

function Banner() {
  const isOnPrem = [GrafanaEdition.OpenSource, GrafanaEdition.Enterprise].includes(config.buildInfo.edition);

  if (!isOnPrem) {
    return null;
  }

  return (
    <Alert severity="info" title={''}>
      <Text>
        <Trans i18nKey={'provisioning.banner.message'}>
          This feature is currently under active development. For the best experience and latest improvements, we
          recommend using the{' '}
          <TextLink href={'https://grafana.com/grafana/download/nightly'} external>
            nightly build
          </TextLink>{' '}
          of Grafana.
        </Trans>
      </Text>
    </Alert>
  );
}
