import { t } from '@grafana/i18n';
import { Alert } from '@grafana/ui';

export const missingRightsMessage =
  'You are not allowed to modify this data source. Please contact your server admin to update this data source.';

export function DataSourceMissingRightsMessage() {
  return (
    <Alert
      severity="info"
      title={t('datasources.data-source-missing-rights-message.title-missing-rights', 'Missing rights')}
    >
      {missingRightsMessage}
    </Alert>
  );
}
