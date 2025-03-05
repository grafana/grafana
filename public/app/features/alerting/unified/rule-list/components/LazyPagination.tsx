import { Button, Icon, Stack } from '@grafana/ui';
import { t } from 'app/core/internationalization';

interface LazyPaginationProps {
  canMoveForward: boolean;
  canMoveBackward: boolean;
  nextPage: () => void;
  previousPage: () => void;
}

export function LazyPagination({ canMoveForward, canMoveBackward, nextPage, previousPage }: LazyPaginationProps) {
  return (
    <Stack direction="row" gap={1}>
      <Button
        aria-label={t('alerting.rule-list.pagination.previous-page', 'previous page')}
        size="sm"
        variant="secondary"
        onClick={previousPage}
        disabled={!canMoveBackward}
      >
        <Icon name="angle-left" />
      </Button>
      <Button
        aria-label={t('alerting.rule-list.pagination.next-page', 'next page')}
        size="sm"
        variant="secondary"
        onClick={nextPage}
        disabled={!canMoveForward}
      >
        <Icon name="angle-right" />
      </Button>
    </Stack>
  );
}
