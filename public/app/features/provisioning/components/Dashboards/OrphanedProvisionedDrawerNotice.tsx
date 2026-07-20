import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

/**
 * Short message for save / delete / move drawers when the dashboard is orphaned.
 * Full explanation and admin actions stay on the page banner to avoid duplication.
 */
export function OrphanedProvisionedDrawerNotice() {
  return (
    <Alert
      severity="info"
      title={t('provisioning.orphaned-drawer-notice.title', 'Provisioning repository no longer exists')}
    >
      <Trans i18nKey="provisioning.orphaned-drawer-notice.body">
        Save, move, and delete through the Git workflow are not available. Use the warning at the top of the dashboard
        to release or delete this dashboard if you are an administrator, or contact your Grafana administrator.
      </Trans>
    </Alert>
  );
}
