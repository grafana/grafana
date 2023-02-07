import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Alert, AlertVariant } from '@grafana/ui/src';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

const FLOW_DESCRIPTION: Record<string, { severity: AlertVariant; description: string }> = {
  create: {
    severity: 'error',
    description: 'Currently, dashboards with template variables can’t be public',
  },
  edit: {
    severity: 'warning',
    description: 'This public dashboard may not work since it uses template variables',
  },
};

export const UnsupportedTemplateVariablesAlert = ({ mode }: { mode: 'create' | 'edit' }) => (
  <Alert
    severity={FLOW_DESCRIPTION[mode].severity}
    title="Template variables are not supported"
    data-testid={selectors.TemplateVariablesWarningAlert}
  >
    {FLOW_DESCRIPTION[mode].description}
  </Alert>
);
