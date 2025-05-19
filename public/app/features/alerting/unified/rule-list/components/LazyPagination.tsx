import { useTranslate } from '@grafana/i18n';
import { Button } from '@grafana/ui';

interface LazyPaginationProps {
  loadMore: () => void;
}

export function LazyPagination({ loadMore }: LazyPaginationProps) {
  const { t } = useTranslate();
  const label = t('alerting.rule-list.pagination.next-page', 'Show more…');

  return (
    <Button aria-label={label} fill="text" size="sm" variant="secondary" onClick={loadMore}>
      {label}
    </Button>
  );
}
