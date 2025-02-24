import { Alert } from '@grafana/ui';
import { getMessageFromError } from 'app/core/utils/errors';

interface RequestErrorAlertProps {
  request?: {
    isError: boolean;
    error?: unknown;
    endpointName?: string;
  };
  error?: unknown;
  title?: string;
}

function getDefaultTitle(endpointName?: string): string {
  switch (endpointName) {
    case 'createRepositoryMigrate':
      return 'Failed to migrate dashboards';
    case 'createOrUpdateRepository':
      return 'Failed to save repository settings';
    default:
      return 'Operation failed';
  }
}

export function RequestErrorAlert({ request, error, title }: RequestErrorAlertProps) {
  if (request && !request.isError) {
    return null;
  }

  const errorTitle = title || (request ? getDefaultTitle(request.endpointName) : 'Operation failed');
  const errorMessage = request ? getMessageFromError(request.error) : getMessageFromError(error);

  return (
    <Alert severity="error" title={errorTitle}>
      {errorMessage}
    </Alert>
  );
}
