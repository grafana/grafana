import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Alert } from '@grafana/ui/src';
import { Trans, t } from 'app/core/internationalization';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export const NoUpsertPermissionsAlert = ({ mode }: { mode: 'create' | 'edit' }) => (
  <Alert
    severity="info"
    title={t(
      'public-dashboard.modal-alerts.no-upsert-perm-alert-title',
      'You don’t have permission to {{ mode }} a public dashboard',
      { mode }
    )}
    data-testid={selectors.NoUpsertPermissionsWarningAlert}
    bottomSpacing={0}
  >
    <Trans i18nKey="public-dashboard.modal-alerts.no-upsert-perm-alert-desc">
      Contact your admin to get permission to {{ mode }} public dashboards
    </Trans>
  </Alert>
);
