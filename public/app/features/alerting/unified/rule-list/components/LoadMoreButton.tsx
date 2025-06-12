import { t } from '@grafana/i18n';
import { Button } from '@grafana/ui';

interface LoadMoreButtonProps {
  onClick: () => void;
}

export function LoadMoreButton({ onClick }: LoadMoreButtonProps) {
  const label = t('alerting.rule-list.pagination.next-page', 'Show more…');

  return (
    <Button aria-label={label} fill="text" size="sm" variant="secondary" onClick={onClick}>
      {label}
    </Button>
  );
}
