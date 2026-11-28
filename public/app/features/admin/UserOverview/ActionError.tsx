import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { getMessageFromError } from 'app/core/utils/errors';

export function ActionError({ error }: { error: unknown }) {
  return (
    <Alert
      severity="error"
      title={t('admin.user-overview.action-error', 'Unable to complete the request. Please try again.')}
    >
      {getMessageFromError(error)}
    </Alert>
  );
}
