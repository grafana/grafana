import { Trans, t } from '@grafana/i18n';
import { EmptyState } from '@grafana/ui';

interface EmptyResultsProps {
  datasourceType: string;
  hasSearchQuery: boolean;
}

export const EmptyResults = ({ datasourceType, hasSearchQuery }: EmptyResultsProps) => (
  <EmptyState
    variant="call-to-action"
    message={
      datasourceType
        ? t('dashboard-library.merged-empty-title-with-datasource', 'No {{datasourceType}} dashboards found', {
            datasourceType,
          })
        : t('dashboard-library.merged-empty-title', 'No dashboards found')
    }
  >
    {hasSearchQuery ? (
      <Trans i18nKey="dashboard-library.merged-empty-search">
        Try a different search term or browse more dashboards on Grafana.com.
      </Trans>
    ) : (
      <Trans i18nKey="dashboard-library.merged-empty-no-dashboards">
        No dashboards are available for this datasource.
      </Trans>
    )}
  </EmptyState>
);
