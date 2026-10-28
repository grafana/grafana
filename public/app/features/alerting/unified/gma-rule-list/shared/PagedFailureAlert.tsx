import { t } from '@grafana/i18n';

import { InlineRequestError } from './InlineRequestError';

export interface PagedFailure {
  kind: 'load-more' | 'refresh';
  error: unknown;
}

interface PagedFailureAlertProps {
  failure: PagedFailure;
  onRetry: () => void;
}

/** Names which request of a paged list failed, so Retry is not mistaken for restarting the list. */
export function PagedFailureAlert({ failure, onRetry }: PagedFailureAlertProps) {
  const title =
    failure.kind === 'load-more'
      ? t('alerting.gma-rule-list.shared.load-more-error', 'Failed to load more results')
      : t('alerting.gma-rule-list.shared.refresh-error', 'Failed to refresh results');

  return <InlineRequestError title={title} error={failure.error} onRetry={onRetry} />;
}
