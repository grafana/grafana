import { Alert } from '@grafana/ui';
import { t } from 'app/core/internationalization';
import { getMessageFromError } from 'app/core/utils/errors';

interface RequestErrorAlertProps {
  request?: {
    isError: boolean;
    error?: unknown;
    endpointName?: string;
  } | null;
  title?: string;
}

function getDefaultTitle(endpointName?: string): string {
  switch (endpointName) {
    case 'createRepositorySync':
      return t('provisioning.request-error.failed-to-sync', 'Failed to sync dashboards');
    case 'createRepositoryMigrate':
      return t('provisioning.request-error.failed-to-migrate', 'Failed to migrate dashboards');
    case 'createOrUpdateRepository':
      return t('provisioning.request-error.failed-to-save', 'Failed to save repository');
    default:
      return t('provisioning.request-error.operation-failed', 'Operation failed');
  }
}

export function RequestErrorAlert({ request, title }: RequestErrorAlertProps) {
  if (!request || !request.isError) {
    return null;
  }

  const errorTitle = title || getDefaultTitle(request.endpointName);
  const errorMessage = getMessageFromError(request.error);

  return (
    <Alert severity="error" title={errorTitle}>
      {errorMessage}
    </Alert>
  );
}
