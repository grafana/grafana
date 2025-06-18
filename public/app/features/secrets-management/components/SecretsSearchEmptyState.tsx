import { Trans, t } from '@grafana/i18n';
import { EmptyState } from '@grafana/ui';

export function SecretsSearchEmptyState() {
  return (
    <EmptyState variant="not-found" message={t('secrets.search-result.no-results', 'No secrets found')}>
      <Trans i18nKey="secrets.search-result.clear-filters">Clear active filter to see all secrets.</Trans>
    </EmptyState>
  );
}
