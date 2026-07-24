import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';
import { extractErrorMessage } from 'app/api/utils';

export function FormLoadingErrorAlert({ error }: { error: unknown }) {
  const message = extractErrorMessage(
    error,
    t(
      'dashboard-scene.save-provisioned-dashboard-form.form-loading-error-unknown',
      'An unexpected error occurred while loading the form.'
    )
  );

  return (
    <Alert
      severity="error"
      title={t('dashboard-scene.save-provisioned-dashboard-form.form-loading-error', 'Error loading form')}
    >
      {message}
    </Alert>
  );
}
