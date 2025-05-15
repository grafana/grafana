import { EmptyState } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

export function SecretsSearchEmptyState() {
  return (
    <EmptyState variant="not-found" message={t('secrets-management.page.search-result.no-results', 'No secrets found')}>
      <Trans i18nKey="secrets-management.page.search-result.clear-filters">
        Clear active filter to see all secrets.
      </Trans>
    </EmptyState>
  );
}
