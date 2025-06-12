import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

interface LazyPaginationProps {
  loadMore: () => void;
  disabled?: boolean;
}

export function LazyPagination({ loadMore, disabled = false }: LazyPaginationProps) {
  const label = t('alerting.rule-list.pagination.next-page', 'Show more…');

  return (
    <Button aria-label={label} fill="text" size="sm" variant="secondary" onClick={loadMore} disabled={disabled}>
      {label}
    </Button>
  );
}
