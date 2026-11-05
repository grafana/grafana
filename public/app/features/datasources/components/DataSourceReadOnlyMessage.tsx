import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

export const readOnlyMessage =
  'This data source was added by config and cannot be modified using the UI. Please contact your server admin to update this data source.';

export function DataSourceReadOnlyMessage() {
  return (
    <Alert
      data-testid={e2eSelectors.pages.DataSource.readOnly}
      severity="info"
      title={t('datasources.data-source-read-only-message.title-provisioned-data-source', 'Provisioned data source')}
    >
      {readOnlyMessage}
    </Alert>
  );
}

/**
 * Shown when an external manager other than Git Sync owns the data source and does not allow UI
 * edits. Git Sync-managed data sources stay editable: their save goes through the provisioning
 * drawer instead, which commits the change to the repository.
 */
export function DataSourceManagedReadOnlyMessage() {
  return (
    <Alert
      severity="info"
      title={t('datasources.data-source-managed-read-only-message.title-managed-data-source', 'Managed data source')}
    >
      <Trans i18nKey="datasources.data-source-managed-read-only-message.body">
        This data source is managed externally and cannot be modified using the UI. Update it where it is defined.
      </Trans>
    </Alert>
  );
}
