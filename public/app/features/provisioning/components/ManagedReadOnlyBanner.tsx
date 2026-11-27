import { t, Trans } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

/**
 * Read-only banner for the edit form of any provisioning resource (Repository, Connection, ...)
 * owned by an external manager that does not allow edits. The copy is resource- and
 * manager-agnostic on purpose so every kind and manager can share it.
 */
export function ManagedReadOnlyBanner() {
  return (
    <Alert
      severity="info"
      title={t('provisioning.managed-read-only-banner.title', 'This resource is managed externally')}
    >
      <Trans i18nKey="provisioning.managed-read-only-banner.body">
        Its configuration is managed outside Grafana and is read-only here. Change it where it is defined.
      </Trans>
    </Alert>
  );
}
