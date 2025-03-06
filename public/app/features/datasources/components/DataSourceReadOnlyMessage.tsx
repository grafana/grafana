import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Alert } from '@grafana/ui';
import { t } from 'app/core/internationalization';

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
