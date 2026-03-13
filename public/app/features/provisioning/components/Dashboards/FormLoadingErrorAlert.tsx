import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

import { extractErrorMessage } from '../../../../api/utils';

export function FormLoadingErrorAlert({ error }: { error: unknown }) {
  return (
    <Alert
      severity="error"
      title={t('dashboard-scene.save-provisioned-dashboard-form.form-loading-error', 'Error loading form')}
    >
      {extractErrorMessage(error)}
    </Alert>
  );
}
