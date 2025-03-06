import { useNavigate } from 'react-router-dom-v5-compat';

import { LinkButton, Alert, Stack, Text, Button, Box, Card, Icon } from '@grafana/ui';

import { useGetFrontendSettingsQuery } from '../api';
import { CONNECT_URL, MIGRATE_URL } from '../constants';
import { css } from '@emotion/css';

export default function GettingStarted() {
  const settingsQuery = useGetFrontendSettingsQuery();
  const legacyStorage = settingsQuery.data?.legacyStorage;
  const navigate = useNavigate();

  return (
    <>
      {legacyStorage && (
        <Alert severity="info" title="Setting up this connection could cause a temporary outage">
          When you connect your whole instance, dashboards will be unavailable while running the migration. We recommend
          warning your users before starting the process.
        </Alert>
      )}
      <Stack direction="row" gap={2}>
        <Box width="50%">
          <Text variant="h2">Provisining as-code directly from Grafana</Text>
          <Box padding={2}>
            <Stack direction="column" gap={2}>
              <Text variant="body">
                ✔️ Manage your dashboards as code and deploy them automatically from your GitHub repository or local
                storage
              </Text>
              <Text variant="body">
                ✔️ Review, discuss, and approve dashboard changes with your team before they go live using GitHub pull
                requests
              </Text>
              <Text variant="body">
                ✔️ Export your existing dashboards as code and store them in GitHub repositories for version control and
                collaboration
              </Text>
              <LinkButton fill="text" href="#" icon="external-link-alt">
                Learn more
              </LinkButton>
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
            </Stack>
          </Box>
        </Box>
        <Box width="50%">
          <div
            className={css`
              height: 100%;
              background: linear-gradient(to right, rgba(255, 179, 102, 0.6), rgba(255, 143, 143, 0.8));
              border-radius: 4px;
              padding: 16px;
              display: flex;
              align-items: center;
              justify-content: center;
            `}
          >
            <Text variant="h2">Engaging Graphic</Text>
          </div>
        </Box>
      </Stack>
      <Box padding={2}>
        <Text variant="h2">Unlock enhanced functionality for Github</Text>
        <Stack direction="row" gap={2}>
          <Box width="50%">
            <Stack direction="column" gap={2}>
              <Text variant="h3">Automatic provisioning as soon as changes are merged</Text>
              <div
                className={css`
                  background: rgba(24, 121, 219, 0.12);
                  border-radius: 50%;
                  padding: 16px;
                  width: fit-content;
                `}
              >
                <Icon name="sync" size="xxl" color="primary" />
              </div>
              <Text variant="body">
                Automatically provision and update your dashboards as soon as changes are pushed to your GitHub
                repository
              </Text>
              <Button variant="secondary">Setup Public Access</Button>
            </Stack>
          </Box>
          <Box width="50%">
            <Stack direction="column" gap={2}>
              <Text variant="h3">Visual Previews in Pull Requests</Text>
              <Stack direction="row" gap={2}>
                <div
                  className={css`
                    background: rgba(255, 120, 10, 0.12);
                    border-radius: 50%;
                    padding: 16px;
                    width: fit-content;
                  `}
                >
                  <Icon name="camera" size="xxl" color="orange" />
                </div>
                <div
                  className={css`
                    background: rgba(135, 73, 237, 0.12);
                    border-radius: 50%;
                    padding: 16px;
                    width: fit-content;
                  `}
                >
                  <Icon name="github" size="xxl" color="purple" />
                </div>
              </Stack>
              <Text variant="body">
                Review how your changes look like before going live in Grafana and directly in Pull Requests
              </Text>
              <Button variant="secondary">Setup Image Rendering</Button>
            </Stack>
          </Box>
        </Stack>
      </Box>
    </>
  );
}
