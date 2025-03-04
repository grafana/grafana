import SVG from 'react-inlinesvg';
import { useNavigate } from 'react-router-dom-v5-compat';

import { EmptyState, LinkButton, Alert, Stack, Text, Button } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { useGetFrontendSettingsQuery } from './api';
import { NEW_URL, MIGRATE_URL } from './constants';

export default function OnboardingPage({ legacyStorage }: { legacyStorage?: boolean }) {
  const settingsQuery = useGetFrontendSettingsQuery();
  const navigate = useNavigate();

  const onClick = async () => {
    if (legacyStorage) {
      await settingsQuery.refetch();
      navigate(MIGRATE_URL);
    } else {
      navigate(NEW_URL);
    }
  };

  return (
    <Page
      navId="provisioning"
      pageNav={{ text: 'Setup provisioning', subTitle: 'Configure this instance to use provisioning' }}
    >
      <Page.Contents>
        {legacyStorage && (
          <Alert severity="info" title="Setting up this connection could cause a temporary outage">
            When you connect your whole instance, dashboards will be unavailable while running the migration. We
            recommend warning your users before starting the process.
          </Alert>
        )}
        <EmptyState
          variant="call-to-action"
          message="Set up your provisioning connection!"
          image={<SVG src="public/img/provisioning-empty.svg" width={300} />}
          button={
            <Button size="lg" icon="plus" onClick={onClick}>
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
      </Page.Contents>
    </Page>
  );
}
