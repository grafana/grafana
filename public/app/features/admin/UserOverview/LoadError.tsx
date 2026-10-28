import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { getStatusFromError } from 'app/core/utils/errors';

export function LoadError({ error }: { error: unknown }) {
  const status = getStatusFromError(error);
  return (
    <Alert
      severity="warning"
      title={
        status === 403
          ? t('admin.user-overview.forbidden', 'You do not have permission to view this information')
          : status === 404
            ? t('admin.user-overview.not-found', 'This information is not available')
            : t('admin.user-overview.load-error', 'Unable to load this information. Please try again.')
      }
    />
  );
}
