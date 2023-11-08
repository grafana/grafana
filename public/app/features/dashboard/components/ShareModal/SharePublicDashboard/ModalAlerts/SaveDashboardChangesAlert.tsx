import React from 'react';

import { Alert } from '@grafana/ui/src';
import { t } from 'app/core/internationalization';

export const SaveDashboardChangesAlert = () => (
  <Alert
    title={t(
      'save-dashboard-changes-alert.public-dashboard.alert-title',
      'Please save your dashboard changes before updating the public configuration'
    )}
    severity="warning"
    bottomSpacing={0}
  />
);
