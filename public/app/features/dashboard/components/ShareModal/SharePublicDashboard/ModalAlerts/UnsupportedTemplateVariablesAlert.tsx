import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { Alert } from '@grafana/ui/src';
import { Trans, t } from 'app/core/internationalization';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export const UnsupportedTemplateVariablesAlert = ({ showDescription = true }: { showDescription?: boolean }) => (
  <Alert
    severity="warning"
    title={t(
      'public-dashboard.modal-alerts.unsupported-template-variable-alert-title',
      'Template variables are not supported'
    )}
    data-testid={selectors.TemplateVariablesWarningAlert}
    bottomSpacing={0}
  >
    {showDescription && (
      <Trans i18nKey="public-dashboard.modal-alerts.unsupported-template-variable-alert-desc">
        This public dashboard may not work since it uses template variables
      </Trans>
    )}
  </Alert>
);
