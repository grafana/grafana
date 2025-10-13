import { Alert } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

export function TokenErrorAlert() {
  return (
    <Alert severity="error" title={t('migrate-to-cloud.migration-token.error-title', 'Something went wrong')}>
      <Trans i18nKey="migrate-to-cloud.migration-token.error-body">
        Unable to generate a migration token. Please try again later.
      </Trans>
    </Alert>
  );
}
