import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Alert } from '@grafana/ui/src';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export const NoUpsertPermissionsAlert = ({ mode }: { mode: 'create' | 'edit' }) => (
  <Alert
    severity="info"
    title={`You don’t have permission to ${mode} a public dashboard`}
    data-testid={selectors.NoUpsertPermissionsWarningAlert}
  >
    Contact your admin to get permission to {mode} create public dashboards
  </Alert>
);
