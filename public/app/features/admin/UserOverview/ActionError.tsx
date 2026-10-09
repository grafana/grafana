import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

export function ActionError() {
  return (
    <Alert severity="error" title={t('admin.user-overview.update-error', 'Unable to update user. Please try again.')} />
  );
}
