import { Trans } from '@grafana/i18n';
import { Button } from '@grafana/ui';

import { PagedFailureAlert } from './PagedFailureAlert';
import { type PagedFailure } from './pagedQuery';

interface LoadMoreFooterProps {
  hasMore: boolean;
  isLoadingMore: boolean;
  failure?: PagedFailure;
  onLoadMore: () => void;
  onRetry: () => void;
}

export function LoadMoreFooter({ hasMore, isLoadingMore, failure, onLoadMore, onRetry }: LoadMoreFooterProps) {
  if (failure) {
    return <PagedFailureAlert failure={failure} onRetry={onRetry} />;
  }
  if (!hasMore) {
    return null;
  }
  return (
    <div>
      <Button
        size="sm"
        variant="secondary"
        disabled={isLoadingMore}
        icon={isLoadingMore ? 'spinner' : undefined}
        onClick={onLoadMore}
      >
        <Trans i18nKey="alerting.gma-rule-list.shared.load-more">Load more</Trans>
      </Button>
    </div>
  );
}
