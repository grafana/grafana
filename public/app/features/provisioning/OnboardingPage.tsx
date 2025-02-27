import SVG from 'react-inlinesvg';
import { useNavigate } from 'react-router-dom-v5-compat';

import { EmptyState, LinkButton, Alert, Stack, Text, Button } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { StatusAlerts } from './Setup/StatusAlerts';
import { useGetFrontendSettingsQuery } from './api';
import { NEW_URL, MIGRATE_URL } from './constants';

export default function OnboardingPage({ legacyStorage }: { legacyStorage?: boolean }) {
  const settingsQuery = useGetFrontendSettingsQuery();
  const navigate = useNavigate();
  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Setup provisioning', subTitle: 'Configure this instance to use provisioning' }}
    >
      <Page.Contents>
        <StatusAlerts />
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
                <Button
                  size="lg"
                  icon="plus"
                  onClick={async () => {
                    await settingsQuery.refetch();
                    navigate(MIGRATE_URL);
                  }}
                >
                  Connect Grafana to repository
                </Button>
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
