import SVG from 'react-inlinesvg';
import { useNavigate } from 'react-router-dom-v5-compat';

import { EmptyState, LinkButton, Alert, Stack, Text, Button, Box, Card } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { FeatureList } from './FeatureList';
import { useGetFrontendSettingsQuery } from '../api';
import { CONNECT_URL, MIGRATE_URL } from '../constants';

export default function GettingStartedPage({ legacyStorage }: { legacyStorage?: boolean }) {
  const settingsQuery = useGetFrontendSettingsQuery();
  const navigate = useNavigate();

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
            <Button
              size="lg"
              icon="plus"
              onClick={async () => {
                await settingsQuery.refetch();
                navigate(MIGRATE_URL);
              }}
            >
              Migrate Grafana to repository
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
        <Stack direction="column" gap={2} alignItems="center" justifyContent="center">
          <Box padding={2}>
            <Card>
              <Card.Description>
                Alternatively, connect to repository and add more repositories for other folders as needed
              </Card.Description>
              <Card.Actions>
                <Button
                  size="md"
                  variant="secondary"
                  icon="plus"
                  onClick={async () => {
                    await settingsQuery.refetch();
                    navigate(CONNECT_URL);
                  }}
                >
                  Connect Grafana to repository
                </Button>
              </Card.Actions>
            </Card>
          </Box>
        </Stack>
        <FeatureList />
      </Page.Contents>
    </Page>
  );
}
