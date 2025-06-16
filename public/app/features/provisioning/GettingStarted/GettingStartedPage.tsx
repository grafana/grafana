import { Trans, t } from '@grafana/i18n';
import { Box, Text, TextLink } from '@grafana/ui';
import { Repository } from 'app/api/clients/provisioning/v0alpha1';
import { Page } from 'app/core/components/Page/Page';

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
        <Banner />
        <GettingStarted items={items} />
      </Page.Contents>
    </Page>
  );
}

function Banner() {
  return (
    <Box
      display="flex"
      backgroundColor={'info'}
      borderRadius="default"
      paddingY={2}
      paddingX={2}
      marginBottom={3}
      alignItems="stretch"
    >
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
    </Box>
  );
}
