import { selectors as e2eSelectors } from '@grafana/e2e-selectors/src';
import { config } from '@grafana/runtime';
import { Alert } from '@grafana/ui/src';
import { Trans, t } from 'app/core/internationalization';

const selectors = e2eSelectors.pages.ShareDashboardModal.PublicDashboard;

export const NoUpsertPermissionsAlert = ({ mode }: { mode: 'create' | 'edit' }) => {
  const title = config.featureToggles.newDashboardSharingComponent
    ? t(
        'public-dashboard.share-externally.no-upsert-perm-alert-title',
        'You don’t have permission to {{ mode }} a shared dashboard',
        { mode }
      )
    : t(
        'public-dashboard.modal-alerts.no-upsert-perm-alert-title',
        'You don’t have permission to {{ mode }} a public dashboard',
        { mode }
      );

  return (
    <Alert severity="warning" title={title} data-testid={selectors.NoUpsertPermissionsWarningAlert} bottomSpacing={0}>
      {config.featureToggles.newDashboardSharingComponent ? (
        <Trans i18nKey="public-dashboard.share-externally.no-upsert-perm-alert-desc">
          Contact your admin to get permission to {{ mode }} shared dashboards
        </Trans>
      ) : (
        <Trans i18nKey="public-dashboard.modal-alerts.no-upsert-perm-alert-desc">
          Contact your admin to get permission to {{ mode }} public dashboards
        </Trans>
      )}
    </Alert>
  );
};
