import React from 'react';

import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Alert } from '@grafana/ui/src';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export const UnsupportedTemplateVariablesAlert = () => (
  <Alert
    severity="warning"
    title="Template variables are not supported"
    data-testid={selectors.TemplateVariablesWarningAlert}
  >
    This public dashboard may not work since it uses template variables
  </Alert>
);
