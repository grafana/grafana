import SVG from 'react-inlinesvg';

import { EmptyState, LinkButton, Alert, Stack, Text } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { SetupWarnings } from './Setup/SetupWarnings';
import { NEW_URL, MIGRATE_URL } from './constants';

export default function OnboardingPage({ legacyStorage }: { legacyStorage?: boolean }) {
  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Setup provisioning', subTitle: 'Configure this instance to use provisioning' }}
    >
      <Page.Contents>
        <SetupWarnings />
        {legacyStorage ? (
          <>
            <Alert severity="info" title="Setting up this connection could cause a temporary outage">
              When you connect your whole instance, dashboards will be unavailable while running the migration. We
              recommend warning your users before starting the process.
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
          </>
        ) : (
          <EmptyState
            variant="call-to-action"
            message="You haven't created any repository configs yet"
            button={
              <LinkButton icon="plus" href={NEW_URL} size="lg">
                Create repository config
              </LinkButton>
            }
          />
        )}
      </Page.Contents>
    </Page>
  );
}
