import { Trans, t } from '@grafana/i18n';
import { Alert, Button, Stack } from '@grafana/ui';

interface Props {
  onDismiss: () => void;
}

/**
 * Short message for save / delete / move drawers when the dashboard is orphaned.
 * Full explanation and admin actions stay on the page banner to avoid duplication.
 */
export function OrphanedProvisionedDrawerNotice({ onDismiss }: Props) {
  return (
    <Stack direction="column" gap={2}>
      <Alert
        severity="info"
        title={t(
          'provisioning.orphaned-drawer-notice.title',
          'Provisioning repository no longer exists'
        )}
      >
        <Trans i18nKey="provisioning.orphaned-drawer-notice.body">
          Save, move, and delete through the Git workflow are not available. Use the warning at the top of the
          dashboard to release or delete this dashboard if you are an administrator, or contact your Grafana
          administrator.
        </Trans>
      </Alert>
      <div>
        <Button variant="secondary" onClick={onDismiss}>
          {t('provisioning.orphaned-drawer-notice.close', 'Close')}
        </Button>
      </div>
    </Stack>
  );
}
