import SVG from 'react-inlinesvg';

import { EmptyState, LinkButton, Alert, Stack, Text } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { SetupWarnings } from './SetupWarnings';
import { MIGRATE_URL } from './constants';

export default function OnboardingPage() {
  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Setup provisioning', subTitle: 'Configure this instance to use provisioning' }}
    >
      <Page.Contents>
        <SetupWarnings />
        <Alert severity="info" title="Setting up this connection could cause a temporary outage">
          When you connect your whole instance, depending on its size, the setup might make the dashboard unavailable to
          users for up to 30 minutes. We recommend warning your users before starting the process. You can use the
          announcement banner or your preferred channels.
        </Alert>
        <EmptyState
          variant="call-to-action"
          message="Set up your provisioning connection!"
          image={<SVG src="public/img/provisioning-empty.svg" width={300} />}
          button={
            <LinkButton size="lg" icon="plus" href={MIGRATE_URL}>
              Connect Grafana to repository
            </LinkButton>
          }
        >
          <Stack direction="column" alignItems="center">
            <Text>Store and provision your Grafana resources externally by connecting to a repository.</Text>
            <Text>We currently support GitHub and local storage.</Text>
            <LinkButton fill="text" href="#" icon="external-link-alt">
              Learn more
            </LinkButton>
          </Stack>
        </EmptyState>
      </Page.Contents>
    </Page>
  );
}
