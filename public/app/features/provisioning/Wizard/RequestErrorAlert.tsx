import { Alert } from '@grafana/ui';
import { getMessageFromError } from 'app/core/utils/errors';

interface RequestErrorAlertProps {
  request: {
    isError: boolean;
    error?: unknown;
    endpointName?: string;
  };
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

export function RequestErrorAlert({ request, title }: RequestErrorAlertProps) {
  if (!request.isError) {
    return null;
  }

  const errorTitle = title || getDefaultTitle(request.endpointName);

  return (
    <Alert severity="error" title={errorTitle}>
      {getMessageFromError(request.error)}
    </Alert>
  );
}
