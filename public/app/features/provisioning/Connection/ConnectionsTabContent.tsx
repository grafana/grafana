import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { getErrorMessage } from 'app/api/clients/provisioning/utils/httpUtils';
import { Connection } from 'app/api/clients/provisioning/v0alpha1';

import { ConnectionList } from './ConnectionList';

interface Props {
  items: Connection[];
  error?: unknown;
}

export function ConnectionsTabContent({ items, error }: Props) {
  if (error) {
    return (
      <Alert severity="error" title={t('provisioning.connections.error-loading', 'Failed to load connections')}>
        {getErrorMessage(error)}
      </Alert>
    );
  }

  return <ConnectionList items={items} />;
}
