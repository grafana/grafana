import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Alert } from '@grafana/ui/src';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export const UnsupportedTemplateVariablesAlert = () => (
  <Alert
    severity="error"
    title="Template variables are not supported"
    data-testid={selectors.TemplateVariablesWarningAlert}
  >
    Currently dashboards with template variables can’t be public.
  </Alert>
);
