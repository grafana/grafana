import { t } from '@grafana/i18n';
import { SearchStatus } from '@grafana/ui/internal';

interface TransformationSearchStatusProps {
  count: number;
}

/**
 * Announces the number of transformation search results to screen readers.
 */
export function TransformationSearchStatus({ count }: TransformationSearchStatusProps) {
  const message =
    count === 0
      ? t('dashboard.transformation-search-status.no-results', 'No transformations found')
      : t('dashboard.transformation-search-status.results-found', '', {
          count,
          defaultValue_one: '{{count}} transformation found',
          defaultValue_other: '{{count}} transformations found',
        });

  return <SearchStatus message={message} />;
}
