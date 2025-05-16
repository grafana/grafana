import { useTranslate } from '@grafana/i18n';
import { Button, Icon, Stack } from '@grafana/ui';

interface LazyPaginationProps {
  loadMore: () => void;
}

export function LazyPagination({ loadMore }: LazyPaginationProps) {
  const { t } = useTranslate();
  const label = t('alerting.rule-list.pagination.next-page', 'Show more rule groups');

  return (
    <Stack direction="row" alignItems="center">
      <Button aria-label={label} fill="outline" size="sm" variant="secondary" onClick={loadMore}>
        <Stack direction="row" alignItems="center" gap={0.5}>
          <Icon name="angle-down" />
          {label}
        </Stack>
      </Button>
    </Stack>
  );
}
