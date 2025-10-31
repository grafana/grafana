import { Trans, t } from '@grafana/i18n';
import { Alert, Stack, Text, TextLink } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning/v0alpha1';
import { Page } from 'app/core/components/Page/Page';

import { isOnPrem } from '../utils/isOnPrem';

import GettingStarted from './GettingStarted';

interface Props {
  items: Repository[];
}

export default function GettingStartedPage({ items }: Props) {
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
          <GettingStarted items={items} />
        </Stack>
      </Page.Contents>
    </Page>
  );
}

function Banner() {
  if (!isOnPrem()) {
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
