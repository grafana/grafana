import { Button, Icon, Stack } from '@grafana/ui';

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
        aria-label={`previous page`}
        size="sm"
        variant="secondary"
        onClick={previousPage}
        disabled={!canMoveBackward}
      >
        <Icon name="angle-left" />
      </Button>
      <Button aria-label={`next page`} size="sm" variant="secondary" onClick={nextPage} disabled={!canMoveForward}>
        <Icon name="angle-right" />
      </Button>
    </Stack>
  );
}
