import { t, Trans } from '@grafana/i18n';
import { Alert, EmptyState, LinkButton, Stack, Text } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';

import { CONNECTIONS_URL } from '../constants';
import { useConnectionList } from '../hooks/useConnectionList';
import { getErrorMessage } from '../utils/httpUtils';

import { ConnectionList } from './ConnectionList';

export default function ConnectionsPage() {
  const [items, isLoading, error] = useConnectionList({ watch: true });
  const hasNoConnections = !isLoading && !error && items?.length === 0;

  return (
    <Page
      navId="provisioning"
      pageNav={{
        text: t('provisioning.connections.page-title', 'Connections'),
        subTitle: t('provisioning.connections.page-subtitle', 'View and manage your app connections'),
      }}
      actions={
        <LinkButton variant="primary" href={`${CONNECTIONS_URL}/new`}>
          <Trans i18nKey="provisioning.connections.add-connection">Add connection</Trans>
        </LinkButton>
      }
    >
      <Page.Contents isLoading={isLoading}>
        <Stack direction={'column'} gap={3}>
          {!!error && (
            <Alert severity="error" title={t('provisioning.connections.error-loading', 'Failed to load connections')}>
              {getErrorMessage(error)}
            </Alert>
          )}

          {hasNoConnections && (
            <EmptyState
              variant="call-to-action"
              message={t('provisioning.connections.no-connections', 'No connections configured')}
            >
              <Text element="p">
                {t(
                  'provisioning.connections.no-connections-message',
                  'Add a connection to authenticate with external providers'
                )}
              </Text>
            </EmptyState>
          )}

          {!!items?.length && <ConnectionList items={items} />}
        </Stack>
      </Page.Contents>
    </Page>
  );
}
