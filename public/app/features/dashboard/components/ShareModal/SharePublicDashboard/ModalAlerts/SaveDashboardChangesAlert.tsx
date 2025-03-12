import { Alert } from '@grafana/ui';
import { t } from 'app/core/internationalization';

export const SaveDashboardChangesAlert = () => (
  <Alert
    title={t(
      'public-dashboard.modal-alerts.save-dashboard-changes-alert-title',
      'Please save your dashboard changes before updating the public configuration'
    )}
    severity="warning"
    bottomSpacing={0}
  />
);
