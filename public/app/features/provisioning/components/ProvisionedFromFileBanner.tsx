import { t, Trans } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

/**
 * Read-only banner shown on the edit form of any provisioning resource (Repository, Connection, ...)
 * that was applied from a mounted manifest at startup. The copy is resource-agnostic on purpose so
 * it can be reused across every kind the file bootstrap manages.
 */
export function ProvisionedFromFileBanner() {
  return (
    <Alert
      severity="info"
      title={t('provisioning.provisioned-from-file-banner.title', 'This resource is provisioned from a file')}
    >
      <Trans i18nKey="provisioning.provisioned-from-file-banner.body">
        Its configuration is managed from a mounted manifest and is read-only here. Edit the manifest file to change it.
      </Trans>
    </Alert>
  );
}
