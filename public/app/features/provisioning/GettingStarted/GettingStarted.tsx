import { useNavigate } from 'react-router-dom-v5-compat';

import { LinkButton, Alert, Stack, Text, Button, Box, Card } from '@grafana/ui';

import { FeatureList } from './FeatureList';
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
      <FeatureList />
    </>
  );
}
