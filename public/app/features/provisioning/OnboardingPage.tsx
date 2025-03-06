import SVG from 'react-inlinesvg';
import { useNavigate } from 'react-router-dom-v5-compat';

import { EmptyState, LinkButton, Alert, Stack, Text, Button } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { FeatureList } from './Setup/FeatureList';
import { useGetFrontendSettingsQuery } from './api';
import { MIGRATE_URL } from './constants';

export default function OnboardingPage({ legacyStorage }: { legacyStorage?: boolean }) {
  const settingsQuery = useGetFrontendSettingsQuery();
  const navigate = useNavigate();

  const onClick = async () => {
    await settingsQuery.refetch(); // makes sure we do not have 2 repos targeting the root!
    navigate(MIGRATE_URL);
  };

  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: 'Setup provisioning',
        subTitle:
          'Configure your Grafana instance to use provisioning to manage your dashboards using GitHub and other storage systems',
      }}
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
            <LinkButton fill="text" href="#" icon="external-link-alt">
              Learn more
            </LinkButton>
          </Stack>
        </EmptyState>
        <FeatureList />
      </Page.Contents>
    </Page>
  );
}
