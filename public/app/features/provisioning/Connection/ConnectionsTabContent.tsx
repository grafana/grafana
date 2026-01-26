import { t } from '@grafana/i18n';
import { Alert, Spinner } from '@grafana/ui';

import { useConnectionList } from '../hooks/useConnectionList';
import { getErrorMessage } from '../utils/httpUtils';

import { ConnectionList } from './ConnectionList';

export function ConnectionsTabContent() {
  const [items, isLoading, error] = useConnectionList({ watch: true });

  if (isLoading) {
    return <Spinner />;
  }

  if (error) {
    return (
      <Alert severity="error" title={t('provisioning.connections.error-loading', 'Failed to load connections')}>
        {getErrorMessage(error)}
      </Alert>
    );
  }

  return <ConnectionList items={items ?? []} />;
}
