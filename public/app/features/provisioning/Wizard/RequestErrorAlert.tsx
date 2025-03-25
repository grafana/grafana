import { Alert } from '@grafana/ui';
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
      return 'Failed to sync dashboards';
    case 'createRepositoryMigrate':
      return 'Failed to migrate dashboards';
    case 'createOrUpdateRepository':
      return 'Failed to save repository';
    default:
      return 'Operation failed';
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
