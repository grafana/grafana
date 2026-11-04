import { Trans } from '@grafana/i18n';
import { Box, Button } from '@grafana/ui';

import { type PagedFailure, PagedFailureAlert } from './PagedFailureAlert';

interface LoadMoreFooterProps {
  hasMore: boolean;
  isLoadingMore: boolean;
  failure?: PagedFailure;
  onLoadMore: () => void;
  onRetry: () => void;
  /** Names the button when a page holds several, such as the folder list and an expanded folder. */
  label?: string;
  /** Names Retry the same way, so each Retry on a page is distinguishable. */
  retryLabel?: string;
}

export function LoadMoreFooter({
  hasMore,
  isLoadingMore,
  failure,
  onLoadMore,
  onRetry,
  label,
  retryLabel,
}: LoadMoreFooterProps) {
  if (failure) {
    return <PagedFailureAlert failure={failure} onRetry={onRetry} retryLabel={retryLabel} />;
  }
  if (!hasMore) {
    return null;
  }
  return (
    // Keeps the button at its own width inside a column Stack.
    <Box>
      {/* Not disabled while loading, because a disabled button drops keyboard focus. Button overrides a passed
          aria-disabled, so aria-busy marks the busy state. A next-page request made while one is in flight is
          ignored by RTK Query. */}
      <Button
        size="sm"
        variant="secondary"
        aria-busy={isLoadingMore}
        icon={isLoadingMore ? 'spinner' : undefined}
        onClick={onLoadMore}
      >
        {label ?? <Trans i18nKey="alerting.gma-rule-list.shared.load-more">Load more</Trans>}
      </Button>
    </Box>
  );
}
